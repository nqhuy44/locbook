import sys
import os
from enum import Enum

# Add project root to path
sys.path.append(os.getcwd())

try:
    from src.core.database.sql_models import ListPrivacy
    print(f"Imported ListPrivacy: {ListPrivacy}")
    print(f"Members: {list(ListPrivacy)}")
    print(f"Values: {[e.value for e in ListPrivacy]}")
    
    try:
        val = ListPrivacy('private')
        print(f"Successfully instantiated: {val}")
    except Exception as e:
        print(f"Failed to instantiate 'private': {e}")

    try:
        val = ListPrivacy('public')
        print(f"Successfully instantiated: {val}")
    except Exception as e:
        print(f"Failed to instantiate 'public': {e}")
        
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"An error occurred: {e}")
