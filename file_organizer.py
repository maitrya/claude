# Desktop File Organizer
#
# Moves files in a target folder into subfolders based on scheme.
# Default is a dry run; use --apply to move files.

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Tuple


CATEGORIES: Dict[str, Tuple[str, ...]] = {
    "Images": (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp", ".heic", ".svg"),
    "Docs": (".pdf", ".txt", ".md", ".rtf", ".doc", ".docx", ".odt", ".tex"),
    "Spreadsheets": (".xls", ".xlsx", ".csv", ".ods"),
    "Presentations": (".ppt", ".pptx", ".odp"),
    "Archives": (".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"),
    "Audio": (".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"),
    "Video": (".mp4", ".mkv", ".mov", ".avi", ".wmv", ".webm"),
    "Code": (".py", ".js", ".ts", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".html", ".css", ".json", ".yml", ".yaml", ".toml"),
    "Executables": (".exe", ".msi", ".bat", ".cmd", ".ps1"),
    "Fonts": (".ttf", ".otf", ".woff", ".woff2"),
}


@dataclass
class PlanItem:
    src: Path
    dst: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Organize files in a folder into subfolders.")
    parser.add_argument(
        "path",
        nargs="?",
        default=str(Path.home() / "Desktop"),
        help="Target folder (default: Desktop)",
    )
    parser.add_argument(
        "--scheme",
        choices=["category", "extension", "date"],
        default="category",
        help="Organization scheme (default: category)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes (default is dry run)",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files",
    )
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        help="File or folder names to skip (can be repeated)",
    )
    return parser.parse_args()


def is_hidden(path: Path) -> bool:
    return path.name.startswith(".")


def category_for_ext(ext: str) -> str:
    for name, exts in CATEGORIES.items():
        if ext in exts:
            return name
    return "Others"


def extension_folder(ext: str) -> str:
    return ext[1:].upper() if ext else "NO_EXTENSION"


def date_folder(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def unique_destination(dst: Path) -> Path:
    if not dst.exists():
        return dst
    stem = dst.stem
    suffix = dst.suffix
    parent = dst.parent
    counter = 1
    while True:
        candidate = parent / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def plan_moves(target: Path, scheme: str, include_hidden: bool, skips: Iterable[str]) -> Iterable[PlanItem]:
    skip_set = {s.lower() for s in skips}
    for item in target.iterdir():
        if item.name.lower() in skip_set:
            continue
        if item.is_dir():
            continue
        if not include_hidden and is_hidden(item):
            continue

        ext = item.suffix.lower()
        if scheme == "category":
            folder = category_for_ext(ext)
            dst = target / folder / item.name
        elif scheme == "extension":
            folder = extension_folder(ext)
            dst = target / folder / item.name
        else:
            mtime = datetime.fromtimestamp(item.stat().st_mtime)
            folder = date_folder(mtime)
            dst = target / "ByDate" / folder / item.name

        dst = unique_destination(dst)
        yield PlanItem(src=item, dst=dst)


def main() -> int:
    args = parse_args()
    target = Path(args.path).expanduser().resolve()

    if not target.exists() or not target.is_dir():
        print(f"Target folder not found: {target}")
        return 2

    script_name = Path(__file__).name.lower()
    skips = list(args.skip)
    if script_name not in {s.lower() for s in skips}:
        skips.append(script_name)

    plan = list(plan_moves(target, args.scheme, args.include_hidden, skips))
    if not plan:
        print("No files to organize.")
        return 0

    print(f"Target: {target}")
    print(f"Scheme: {args.scheme}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print("---")

    for item in plan:
        print(f"{item.src.name} -> {item.dst.relative_to(target)}")

    if not args.apply:
        print("---")
        print("Dry run complete. Re-run with --apply to move files.")
        return 0

    for item in plan:
        item.dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(item.src), str(item.dst))

    print("---")
    print(f"Moved {len(plan)} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
