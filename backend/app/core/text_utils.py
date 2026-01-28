"""
Text processing utilities for decoding and normalizing text.
"""

import html
from typing import Any, Dict, List, Optional, Union


def decode_html_entities(text: Optional[str]) -> Optional[str]:
    """
    Decode HTML entities in text.

    Converts HTML entities like &quot;, &#39;, &amp; to their actual characters.

    Args:
        text: Text that may contain HTML entities

    Returns:
        Decoded text, or None if input is None

    Examples:
        >>> decode_html_entities("Hello &quot;world&quot;")
        'Hello "world"'
        >>> decode_html_entities("It&#39;s working")
        "It's working"
        >>> decode_html_entities("Rock &amp; Roll")
        'Rock & Roll'
    """
    if text is None:
        return None
    if not isinstance(text, str):
        return text
    return html.unescape(text)


def decode_html_entities_in_dict(data: Dict[str, Any], keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Decode HTML entities in specific dictionary keys.

    Args:
        data: Dictionary containing text data
        keys: List of keys to decode. If None, decodes all string values.

    Returns:
        Dictionary with decoded values

    Example:
        >>> data = {"title": "&quot;Hello&quot;", "count": 5}
        >>> decode_html_entities_in_dict(data, ["title"])
        {"title": '"Hello"', "count": 5}
    """
    if not data:
        return data

    result = data.copy()

    if keys is None:
        # Decode all string values
        for key, value in result.items():
            if isinstance(value, str):
                result[key] = decode_html_entities(value)
            elif isinstance(value, list):
                result[key] = decode_html_entities_in_list(value)
            elif isinstance(value, dict):
                result[key] = decode_html_entities_in_dict(value)
    else:
        # Decode only specified keys
        for key in keys:
            if key in result and isinstance(result[key], str):
                result[key] = decode_html_entities(result[key])
            elif key in result and isinstance(result[key], list):
                result[key] = decode_html_entities_in_list(result[key])
            elif key in result and isinstance(result[key], dict):
                result[key] = decode_html_entities_in_dict(result[key])

    return result


def decode_html_entities_in_list(items: List[Any]) -> List[Any]:
    """
    Decode HTML entities in list items.

    Args:
        items: List that may contain strings with HTML entities

    Returns:
        List with decoded strings
    """
    if not items:
        return items

    result = []
    for item in items:
        if isinstance(item, str):
            result.append(decode_html_entities(item))
        elif isinstance(item, dict):
            result.append(decode_html_entities_in_dict(item))
        elif isinstance(item, list):
            result.append(decode_html_entities_in_list(item))
        else:
            result.append(item)

    return result


def normalize_text(text: Optional[str]) -> Optional[str]:
    """
    Normalize text by decoding HTML entities and cleaning whitespace.

    Args:
        text: Text to normalize

    Returns:
        Normalized text
    """
    if text is None:
        return None
    if not isinstance(text, str):
        return text

    # Decode HTML entities
    text = decode_html_entities(text)

    # Clean up whitespace
    text = " ".join(text.split())

    return text
