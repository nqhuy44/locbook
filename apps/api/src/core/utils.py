def resize_image(image_bytes: bytes, max_size: tuple[int, int] = (800, 800)) -> bytes:
    """Resize image to fit within max_size while maintaining aspect ratio."""
    from PIL import Image
    import io

    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed (e.g. RGBA)
        if img.mode in ("RGBA", "P"): 
            img = img.convert("RGB")
            
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=85, optimize=True)
        return output.getvalue()
    except Exception as e:
        # Fallback to original if resize fails
        return image_bytes


def to_toon(data: dict, indent: int = 0) -> str:
    """
    Convert a dictionary to TOON (Token-Oriented Object Notation).
    - Uses indentation for structure (YAML-like).
    - Inlines lists of primitives: `tags: [A, B]` instead of vertical lists.
    - Minimal quotes.
    """
    lines = []
    prefix = "  " * indent
    
    for key, value in data.items():
        if isinstance(value, dict):
            lines.append(f"{prefix}{key}:")
            lines.append(to_toon(value, indent + 1))
        elif isinstance(value, list):
            # Optimization: Inline list if all items are primitives (str/int/float)
            if value and all(isinstance(x, (str, int, float, bool)) for x in value):
                # Join with comma space, wrap in brackets. No quotes if simple string.
                # But to be safe and simple, let's just str() them.
                # If strings contain commas, this might be ambiguous, but for LLM context often fine.
                # Let's use simple repr-like but cleaner
                items_str = ", ".join([str(x) for x in value])
                lines.append(f"{prefix}{key}: [{items_str}]")
            else:
                # Vertical list for non-primitives or mixed
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
            # Clean string value
            str_val = str(value).replace("\n", "\\n")
            lines.append(f"{prefix}{key}: {str_val}")
            
    return "\n".join(lines)
