#!/usr/bin/env python3
"""
Simple test script to verify Jupyter kernel execution works
"""
import sys
import traceback

try:
    # Test imports
    print("Testing Jupyter imports...")
    import jupyter_client
    from jupyter_client import KernelManager
    print("✓ Jupyter client available")

    # Test kernel startup
    print("Testing kernel startup...")
    km = KernelManager(kernel_name='python3')
    km.start_kernel()
    print("✓ Kernel started")

    # Test client connection
    kc = km.client()
    kc.start_channels()
    kc.wait_for_ready(timeout=10)
    print("✓ Kernel client connected")

    # Test simple execution
    print("Testing code execution...")
    code = "5 * 5"
    print(f"Executing: {code}")

    msg_id = kc.execute(code)

    # Collect result
    result = None
    while True:
        try:
            msg = kc.get_iopub_msg(timeout=5)
            msg_type = msg['header']['msg_type']

            if msg_type == 'execute_result':
                result = msg['content']['data']['text/plain']
                print(f"✓ Result: {result}")
                break
            elif msg_type == 'status' and msg['content']['execution_state'] == 'idle':
                break
            elif msg_type == 'error':
                print(f"✗ Error: {msg['content']['evalue']}")
                break

        except Exception as e:
            print(f"✗ Timeout or error: {e}")
            break

    # Cleanup
    kc.stop_channels()
    km.shutdown_kernel()
    print("✓ Kernel shutdown")

    # Final result
    if result == '25':
        print("\n🎉 SUCCESS: Jupyter execution working!")
        sys.exit(0)
    else:
        print(f"\n❌ FAILED: Expected '25', got '{result}'")
        sys.exit(1)

except Exception as e:
    print(f"❌ FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)








