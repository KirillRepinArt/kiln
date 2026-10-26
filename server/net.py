"""Outgoing HTTP without the system proxy.

Windows often has a system proxy (VPN clients); Forge is local, so it must never go through one — and Python misreads a
SOCKS system proxy as socks4 and fails, so the update check goes direct too.
"""

import urllib.request

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
