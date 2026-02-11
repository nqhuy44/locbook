def to_toon(data: dict, indent: int = 0) -> str:
    """
    Convert a dictionary to TOON (Token-Oriented Object Notation).
    - Uses indentation for structure (YAML-like).
    - Inlines lists of primitives: `tags: [A, B]` instead of vertical lists.
    - Minimal quotes — optimized for LLM context windows.
    """
    lines = []
    prefix = "  " * indent

    for key, value in data.items():
        if isinstance(value, dict):
            lines.append(f"{prefix}{key}:")
            lines.append(to_toon(value, indent + 1))
        elif isinstance(value, list):
            if value and all(isinstance(x, (str, int, float, bool)) for x in value):
                items_str = ", ".join(str(x) for x in value)
                lines.append(f"{prefix}{key}: [{items_str}]")
            else:
                lines.append(f"{prefix}{key}:")
                for item in value:
                    if isinstance(item, dict):
                        lines.append(f"{prefix}  - ")
                        lines.append(to_toon(item, indent + 2))
                    else:
                        lines.append(f"{prefix}  - {item}")
        elif value is None:
            lines.append(f"{prefix}{key}: null")
        else:
            str_val = str(value).replace("\n", "\\n")
            lines.append(f"{prefix}{key}: {str_val}")

    return "\n".join(lines)
