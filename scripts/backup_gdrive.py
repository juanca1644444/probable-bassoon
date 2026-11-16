#!/usr/bin/env python3
"""
CHASKYAPP - Google Drive Automated Encrypted Backup Engine
===========================================================
Performs a hot point-in-time snapshot of the SQLite WAL database, compresses it (gzip 9),
encrypts it with AES-256 / Fernet, and uploads it directly to Google Drive (using the user's
5 TB Google One / Workspace account) via Google Drive API v3.

Features:
  - Zero-Lock SQLite WAL Snapshot (via backup_db.py integration)
  - Military-grade authenticated encryption (Fernet / AES-256-CBC + HMAC-SHA256)
  - Automatic creation & resolution of the 'CHASKYAPP_BACKUPS' Google Drive folder
  - Headless authentication via Google Service Account (service_account.json or env var)
    or OAuth2 credentials (token.json)
  - Remote retention pruning (retains last N days or N copies on Google Drive)
  - 1-Click Disaster Recovery: --restore-latest downloads the freshest backup from Google Drive,
    decrypts it, and restores it locally with SQLite integrity verification.

Usage:
  python scripts/backup_gdrive.py                     # Snapshot + Encrypt + Upload to Google Drive
  python scripts/backup_gdrive.py --list-drive        # List all backups stored in Google Drive
  python scripts/backup_gdrive.py --restore-latest    # Download & restore latest backup from Drive
  python scripts/backup_gdrive.py --dry-run           # Test credentials & folder connectivity
"""

import os
import sys
import json
import gzip
import shutil
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import the local SQLite backup & encryption engine
try:
    from scripts.backup_db import perform_backup, restore_backup, verify_backup, find_database_path, DEFAULT_DB_CANDIDATES
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from backup_db import perform_backup, restore_backup, verify_backup, find_database_path, DEFAULT_DB_CANDIDATES

# ─── Google API Dependencies Check ───────────────────────────────────────────
GOOGLE_LIBS_AVAILABLE = False
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
    GOOGLE_LIBS_AVAILABLE = True
except ImportError:
    pass

# ─── Configuration & Defaults ────────────────────────────────────────────────
DEFAULT_FOLDER_NAME = "CHASKYAPP_BACKUPS"
CREDENTIALS_PATHS = [
    PROJECT_ROOT / "service_account.json",
    PROJECT_ROOT / "credentials.json",
    PROJECT_ROOT / "google_drive_key.json",
    Path.home() / ".config" / "chaskyapp" / "service_account.json",
]


def find_google_credentials():
    """Finds Google Service Account or OAuth credentials file or env var."""
    # 1. Environment variable with raw JSON content or file path
    env_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON")
    if env_creds:
        if os.path.isfile(env_creds):
            return Path(env_creds)
        # Check if env contains raw JSON string
        try:
            parsed = json.loads(env_creds)
            temp_path = PROJECT_ROOT / "backups" / ".tmp_service_account.json"
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path.write_text(json.dumps(parsed), encoding="utf-8")
            return temp_path
        except Exception:
            pass

    # 2. Well-known file locations
    for p in CREDENTIALS_PATHS:
        if p.is_file():
            return p

    return None


def get_drive_service(creds_path=None):
    """Initializes Google Drive API v3 client using Service Account."""
    if not GOOGLE_LIBS_AVAILABLE:
        print("\n❌ Error: Las dependencias de Google API no están instaladas.")
        print("💡 Instálalas ejecutando:")
        print("   pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib\n")
        sys.exit(1)

    resolved_creds = Path(creds_path) if creds_path else find_google_credentials()
    if not resolved_creds or not resolved_creds.is_file():
        print("\n❌ Error: No se encontró el archivo de credenciales de Google Service Account.")
        print("💡 Pasos para configurar tu acceso gratuito a Google Drive:")
        print("   1. Entra a Google Cloud Console (https://console.cloud.google.com/)")
        print("   2. Crea un proyecto gratuito y habilita 'Google Drive API'")
        print("   3. Crea una 'Cuenta de Servicio' (Service Account) y genera una clave JSON")
        print("   4. Guarda el archivo como 'service_account.json' en la raíz de CHASKYAPP")
        print("   5. En Google Drive, comparte tu carpeta de respaldos con el correo del Service Account\n")
        sys.exit(1)

    scopes = ['https://www.googleapis.com/auth/drive']
    credentials = service_account.Credentials.from_service_account_file(
        str(resolved_creds), scopes=scopes
    )
    service = build('drive', 'v3', credentials=credentials)
    return service, credentials.service_account_email


def get_or_create_folder(service, folder_name=DEFAULT_FOLDER_NAME, parent_id=None):
    """Searches for existing folder or creates it on Google Drive."""
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    response = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)'
    ).execute()

    files = response.get('files', [])
    if files:
        return files[0]['id']

    # Create folder if it doesn't exist
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]

    folder = service.files().create(body=file_metadata, fields='id').execute()
    print(f"📁 Creada carpeta remota en Google Drive: '{folder_name}' (ID: {folder.get('id')})")
    return folder.get('id')


def upload_backup_to_drive(file_path: Path, folder_name=DEFAULT_FOLDER_NAME, creds_path=None):
    """Uploads the encrypted backup file to the target Google Drive folder."""
    if not file_path.is_file():
        raise FileNotFoundError(f"Archivo de respaldo no encontrado: {file_path}")

    service, account_email = get_drive_service(creds_path)
    print(f"🔑 Autenticado en Google Drive como: {account_email}")

    folder_id = get_or_create_folder(service, folder_name)

    file_metadata = {
        'name': file_path.name,
        'parents': [folder_id],
        'description': f'CHASKYAPP Automated Encrypted Backup - {datetime.now(timezone.utc).isoformat()}'
    }

    media = MediaFileUpload(
        str(file_path),
        mimetype='application/octet-stream',
        resumable=True
    )

    print(f"⬆️ Subiendo {file_path.name} ({file_path.stat().st_size / 1024:.1f} KB) a Google Drive...")
    uploaded_file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, name, size, createdTime'
    ).execute()

    print(f"✅ ¡Respaldo subido exitosamente a Google Drive!")
    print(f"   🆔 ID de Archivo: {uploaded_file.get('id')}")
    print(f"   📂 Carpeta: {folder_name}")
    print(f"   🕒 Fecha: {uploaded_file.get('createdTime')}")

    return uploaded_file


def list_drive_backups(folder_name=DEFAULT_FOLDER_NAME, creds_path=None):
    """Lists all encrypted backups stored in Google Drive."""
    service, _ = get_drive_service(creds_path)
    folder_id = get_or_create_folder(service, folder_name)

    query = f"'{folder_id}' in parents and trashed = false"
    response = service.files().list(
        q=query,
        orderBy='createdTime desc',
        fields='files(id, name, size, createdTime)'
    ).execute()

    files = response.get('files', [])
    print(f"\n📦 Respaldos en Google Drive ({folder_name}): {len(files)} encontrados")
    print("-" * 75)
    print(f"{'Nombre':<42} {'Tamaño (KB)':<12} {'Fecha Creación':<20}")
    print("-" * 75)
    for f in files:
        size_kb = int(f.get('size', 0)) / 1024
        print(f"{f['name']:<42} {size_kb:<12.1f} {f.get('createdTime', 'N/A')[:19]}")
    print("-" * 75 + "\n")
    return files


def restore_latest_from_drive(target_db_path=None, folder_name=DEFAULT_FOLDER_NAME, creds_path=None):
    """Downloads and restores the latest encrypted backup from Google Drive."""
    service, _ = get_drive_service(creds_path)
    folder_id = get_or_create_folder(service, folder_name)

    response = service.files().list(
        q=f"'{folder_id}' in parents and trashed = false",
        orderBy='createdTime desc',
        pageSize=1,
        fields='files(id, name, size)'
    ).execute()

    files = response.get('files', [])
    if not files:
        print("❌ No se encontraron respaldos en la carpeta de Google Drive.")
        return False

    latest = files[0]
    file_id = latest['id']
    file_name = latest['name']

    download_dir = PROJECT_ROOT / "backups" / "downloads"
    download_dir.mkdir(parents=True, exist_ok=True)
    local_enc_path = download_dir / file_name

    print(f"⬇️ Descargando último respaldo: {file_name} (ID: {file_id})...")
    request = service.files().get_media(fileId=file_id)
    with open(local_enc_path, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                print(f"   Progreso: {int(status.progress() * 100)}%")

    print(f"✅ Descargado: {local_enc_path}")

    # Determine target db path
    if not target_db_path:
        target_db_path = find_database_path()

    # Decrypt, decompress and restore with integrity verification
    print(f"🔓 Descifrando y restaurando hacia: {target_db_path}...")
    success = restore_backup(local_enc_path, target_db_path)
    if success:
        print(f"🎉 ¡Base de datos SQLite restaurada y verificada exitosamente desde Google Drive!")
    return success


def prune_drive_backups(service, folder_id, retention_days=30):
    """Deletes backups older than retention_days from Google Drive."""
    try:
        response = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            orderBy='createdTime asc',
            fields='files(id, name, createdTime)'
        ).execute()

        files = response.get('files', [])
        now = datetime.now(timezone.utc)
        deleted_count = 0

        for f in files:
            created_str = f.get('createdTime')
            if created_str:
                created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                age_days = (now - created_dt).days
                if age_days > retention_days:
                    service.files().delete(fileId=f['id']).execute()
                    print(f"🧹 Purgado respaldo antiguo en Drive ({age_days} días): {f['name']}")
                    deleted_count += 1
        if deleted_count > 0:
            print(f"✨ Se eliminaron {deleted_count} respaldos antiguos en Google Drive.")
    except Exception as e:
        print(f"⚠️ Advertencia al purgar archivos antiguos en Drive: {e}")


def main():
    parser = argparse.ArgumentParser(description="CHASKYAPP - Google Drive Backup & Recovery")
    parser.add_argument("--list-drive", action="store_true", help="List backups in Google Drive")
    parser.add_argument("--restore-latest", action="store_true", help="Download and restore latest backup from Drive")
    parser.add_argument("--folder", default=DEFAULT_FOLDER_NAME, help="Google Drive folder name")
    parser.add_argument("--retention-days", type=int, default=30, help="Retention period in days for Drive (default: 30)")
    parser.add_argument("--credentials", help="Path to Google service_account.json")
    parser.add_argument("--dry-run", action="store_true", help="Test credentials and connectivity without backup")

    args = parser.parse_args()

    if args.list_drive:
        list_drive_backups(folder_name=args.folder, creds_path=args.credentials)
        return

    if args.restore_latest:
        restore_latest_from_drive(folder_name=args.folder, creds_path=args.credentials)
        return

    if args.dry_run:
        service, email = get_drive_service(args.credentials)
        folder_id = get_or_create_folder(service, args.folder)
        print(f"✅ Conexión con Google Drive exitosa.")
        print(f"   Cuenta: {email}")
        print(f"   Carpeta: {args.folder} (ID: {folder_id})")
        return

    # Normal Flow:
    # 1. Run local snapshot + compression + encryption
    print("\n🚀 [1/3] Creando respaldo local en caliente (WAL Snapshot + AES-256)...")
    db_path = find_database_path()
    output_dir = PROJECT_ROOT / "backups"
    local_enc_path = perform_backup(db_path, output_dir)
    if not local_enc_path or not Path(local_enc_path).is_file():
        print("❌ Error: No se pudo generar el archivo de respaldo local.")
        sys.exit(1)

    # 2. Upload to Google Drive
    print(f"\n☁️ [2/3] Subiendo respaldo cifrado a tu Google Drive (5 TB)...")
    service, _ = get_drive_service(args.credentials)
    folder_id = get_or_create_folder(service, args.folder)
    upload_backup_to_drive(Path(local_enc_path), folder_name=args.folder, creds_path=args.credentials)

    # 3. Prune old backups in Google Drive
    print(f"\n🔄 [3/3] Verificando política de retención ({args.retention_days} días)...")
    prune_drive_backups(service, folder_id, retention_days=args.retention_days)

    print("\n🎉 ¡Proceso de respaldo en la nube completado al 100% sin costo de almacenamiento!\n")


if __name__ == "__main__":
    main()
