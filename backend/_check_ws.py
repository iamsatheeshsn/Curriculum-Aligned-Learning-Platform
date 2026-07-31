from pathlib import Path
path = Path(r"C:\xampp\htdocs\learning_platform\backend\app\Domain\Organization\Services\ControlSchoolWorkspaceService.php")
print("exists", path.exists(), "size", path.stat().st_size if path.exists() else 0)
