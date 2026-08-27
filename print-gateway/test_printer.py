#!/usr/bin/env python3
"""
Office Smart Print Gateway - Self-Test & Diagnostic Tool
Tests local printer spooler connectivity and prints a sample test page.
"""
import os
import sys
import tempfile
import time
from printer import PrinterService

def generate_sample_test_file() -> str:
    """Creates a temporary sample test printout file."""
    temp_dir = tempfile.gettempdir()
    test_file = os.path.join(temp_dir, f"print_test_{int(time.time())}.txt")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("=====================================================\n")
        f.write("        OFFICE SMART PRINT - TEST PAGE\n")
        f.write("=====================================================\n")
        f.write(f"Date/Time:       {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Test Status:     LOCAL SPOOLER VERIFICATION OK\n")
        f.write("Platform:        Windows Native Spooler / Python stdlib\n")
        f.write("=====================================================\n\n")
        f.write("If this page prints successfully, your PC is fully\n")
        f.write("ready to receive and print documents sent from phones!\n")
    return test_file

def main():
    print("=" * 60)
    print("     OFFICE SMART PRINT GATEWAY - PRINTER DIAGNOSTIC")
    print("=" * 60)
    
    printer_svc = PrinterService()
    print(f"\n[1/3] Resolved Printer Target: {printer_svc.printer_name}")
    
    print("\n[2/3] Checking Installed Printers...")
    printers = printer_svc.list_installed_printers()
    for idx, p in enumerate(printers, 1):
        is_target = " (ACTIVE)" if p == printer_svc.printer_name else ""
        print(f"   {idx}. {p}{is_target}")

    online, status_desc = printer_svc.check_printer_status()
    print(f"\nPrinter Status: [{status_desc}]")

    print("\n[3/3] Sending Diagnostic Sample Test Print...")
    test_path = generate_sample_test_file()
    print(f"Generated test file: {test_path}")

    ok, err = printer_svc.print_document(test_path, print_type="BLACK_WHITE", copies=1)
    if ok:
        print("\n[SUCCESS] Test document dispatched to printer spooler!")
        print("Check your printer output tray.")
    else:
        print(f"\n[ERROR] Print test failed: {err}")

    # Cleanup
    try:
        if os.path.exists(test_path):
            os.remove(test_path)
    except Exception:
        pass

    print("\nDiagnostic complete.")

if __name__ == "__main__":
    main()
