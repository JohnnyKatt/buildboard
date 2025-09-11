#!/usr/bin/env python3
"""
Backend API Testing Script
Tests FastAPI endpoints for waitlist and referrals functionality
"""

import requests
import json
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return "https://auto-builds-social.preview.emergentagent.com"

BASE_URL = get_backend_url()
API_URL = f"{BASE_URL}/api"

def test_hello_world():
    """Test GET /api/ endpoint"""
    print("Testing GET /api/ endpoint...")
    try:
        response = requests.get(f"{API_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200 and response.json() == {"message": "Hello World"}:
            print("✅ GET /api/ test PASSED")
            return True
        else:
            print("❌ GET /api/ test FAILED")
            return False
    except Exception as e:
        print(f"❌ GET /api/ test FAILED with error: {e}")
        return False

def test_waitlist_endpoint():
    """Test POST /api/waitlist endpoint"""
    print("\nTesting POST /api/waitlist endpoint...")
    
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "role": "Enthusiast",
        "source_url": "https://example.com/landing?utm_source=ig&utm_campaign=summer&utm_medium=social",
        "utm_source": "ig",
        "utm_campaign": "summer",
        "utm_medium": "social"
    }
    
    try:
        response = requests.post(f"{API_URL}/waitlist", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            # Check if response has id and created_at fields
            if 'id' in data and 'created_at' in data:
                # Verify id format (should be MongoDB ObjectId string)
                if len(data['id']) == 24:  # MongoDB ObjectId length
                    print("✅ POST /api/waitlist test PASSED")
                    print(f"   - ID format valid: {data['id']}")
                    print(f"   - Created at: {data['created_at']}")
                    return True
                else:
                    print("❌ POST /api/waitlist test FAILED - Invalid ID format")
                    return False
            else:
                print("❌ POST /api/waitlist test FAILED - Missing id or created_at fields")
                return False
        else:
            print("❌ POST /api/waitlist test FAILED")
            return False
    except Exception as e:
        print(f"❌ POST /api/waitlist test FAILED with error: {e}")
        return False

def test_referrals_endpoint():
    """Test POST /api/referrals endpoint"""
    print("\nTesting POST /api/referrals endpoint...")
    
    payload = {
        "referrer_name": "Alice",
        "referrer_email": "alice@example.com",
        "referral_type": "Shop",
        "referral_name": "Speed Garage",
        "referral_contact": "@speedgarage",
        "notes": "Great shop",
        "source_url": "https://example.com/refer?utm_source=ig&utm_campaign=summer&utm_medium=social",
        "utm_source": "ig",
        "utm_campaign": "summer",
        "utm_medium": "social"
    }
    
    try:
        response = requests.post(f"{API_URL}/referrals", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            # Check if response has id and created_at fields
            if 'id' in data and 'created_at' in data:
                # Verify id format (should be MongoDB ObjectId string)
                if len(data['id']) == 24:  # MongoDB ObjectId length
                    print("✅ POST /api/referrals test PASSED")
                    print(f"   - ID format valid: {data['id']}")
                    print(f"   - Created at: {data['created_at']}")
                    return True
                else:
                    print("❌ POST /api/referrals test FAILED - Invalid ID format")
                    return False
            else:
                print("❌ POST /api/referrals test FAILED - Missing id or created_at fields")
                return False
        else:
            print("❌ POST /api/referrals test FAILED")
            return False
    except Exception as e:
        print(f"❌ POST /api/referrals test FAILED with error: {e}")
        return False

def test_referrals_validation():
    """Test POST /api/referrals validation - should reject invalid referral_type"""
    print("\nTesting POST /api/referrals validation (negative test)...")
    
    payload = {
        "referrer_name": "Alice",
        "referrer_email": "alice@example.com",
        "referral_type": "Other",  # Invalid type
        "referral_name": "Speed Garage",
        "referral_contact": "@speedgarage",
        "notes": "Great shop",
        "source_url": "https://example.com/refer?utm_source=ig&utm_campaign=summer&utm_medium=social",
        "utm_source": "ig",
        "utm_campaign": "summer",
        "utm_medium": "social"
    }
    
    try:
        response = requests.post(f"{API_URL}/referrals", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 422:
            print("✅ POST /api/referrals validation test PASSED")
            return True
        else:
            print("❌ POST /api/referrals validation test FAILED - Should return 422")
            return False
    except Exception as e:
        print(f"❌ POST /api/referrals validation test FAILED with error: {e}")
        return False

def test_cors():
    """Test CORS OPTIONS request"""
    print("\nTesting CORS OPTIONS /api/waitlist...")
    
    try:
        response = requests.options(f"{API_URL}/waitlist")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        # Check for CORS headers
        cors_headers = [
            'access-control-allow-origin',
            'access-control-allow-methods',
            'access-control-allow-headers'
        ]
        
        has_cors = all(header in response.headers for header in cors_headers)
        
        if response.status_code == 200 and has_cors:
            print("✅ CORS OPTIONS test PASSED")
            return True
        else:
            print("❌ CORS OPTIONS test FAILED")
            return False
    except Exception as e:
        print(f"❌ CORS OPTIONS test FAILED with error: {e}")
        return False

def main():
    """Run all backend tests"""
    print(f"Starting Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print("=" * 50)
    
    tests = [
        test_hello_world,
        test_waitlist_endpoint,
        test_referrals_endpoint,
        test_referrals_validation,
        test_cors
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests PASSED!")
        return 0
    else:
        print("⚠️  Some tests FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())