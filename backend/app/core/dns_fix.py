"""
DNS workaround to use Google Public DNS instead of VPC DNS resolver.
This fixes the 'Failed to resolve w' error when downloading YouTube videos.
"""

import socket
import dns.resolver

# Configure DNS resolver to use Google Public DNS
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '8.8.4.4']

# Store original getaddrinfo
_original_getaddrinfo = socket.getaddrinfo


def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """
    Patched getaddrinfo that uses Google Public DNS for resolution.
    This bypasses the VPC DNS resolver that causes hostname parsing issues.
    """
    try:
        # Use Google Public DNS to resolve hostname
        answers = resolver.resolve(host, 'A')
        if answers:
            ip = str(answers[0])
            # Call original getaddrinfo with resolved IP
            return _original_getaddrinfo(ip, port, family, type, proto, flags)
    except Exception:
        # Fall back to original if DNS resolution fails
        pass

    # Fall back to original getaddrinfo
    return _original_getaddrinfo(host, port, family, type, proto, flags)


def apply_dns_fix():
    """Apply DNS fix by monkey-patching socket.getaddrinfo."""
    socket.getaddrinfo = patched_getaddrinfo
