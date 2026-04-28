"""Utility functions for backend."""

def sanitize_dir_name(name: str) -> str:
    """Entfernt/ersetzt Zeichen die in Windows-Pfaden nicht erlaubt sind."""
    return (
        name.replace("(", "")
            .replace(")", "")
            .replace("'", "")
            .replace("[", "")
            .replace("]", "")
            .replace(" ", "_")
            .replace(",", "-")
    )