#!/usr/bin/env python3
"""
Backend API Testing for Buildboard
Tests all major API endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime
import tempfile
import os

class BuildboardAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.shop_id = None
        self.build_id = None
        self.part_id = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)
        
        if files:
            # Remove Content-Type for file uploads
            test_headers.pop('Content-Type', None)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=data)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    self.log(f"   Response: {response.json()}")
                except:
                    self.log(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_auth_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "name": f"Test Shop {timestamp}",
            "email": f"shop+{timestamp}@test.dev",
            "password": "password",
            "role": "shop"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log(f"   Registered user: {response['user']['email']}")
            return True
        return False

    def test_auth_login(self):
        """Test login with seeded account"""
        success, response = self.run_test(
            "User Login (Seeded Account)",
            "POST",
            "auth/login",
            200,
            data={"email": "apex@shop.dev", "password": "password"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log(f"   Logged in as: {response['user']['email']}")
            return True
        return False

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={"email": "admin@buildboard.dev", "password": "admin123"}
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log(f"   Admin logged in: {response['user']['email']}")
            return True
        return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_shop(self):
        """Test shop creation"""
        shop_data = {
            "name": "Test Auto Shop",
            "locationCity": "Austin",
            "locationState": "TX",
            "website": "https://testshop.com",
            "specialties": ["turbo", "suspension"]
        }
        
        success, response = self.run_test(
            "Create Shop",
            "POST",
            "shops",
            201,
            data=shop_data
        )
        
        if success and 'id' in response:
            self.shop_id = response['id']
            self.log(f"   Created shop ID: {self.shop_id}")
            return True
        return False

    def test_get_my_shop(self):
        """Test getting my shop"""
        success, response = self.run_test(
            "Get My Shop",
            "GET",
            "shops/mine",
            200
        )
        
        if success and response and 'id' in response:
            self.shop_id = response['id']
            self.log(f"   Found shop ID: {self.shop_id}")
            return True
        return success

    def test_create_build(self):
        """Test build creation"""
        if not self.shop_id:
            self.log("❌ Cannot create build - no shop ID")
            return False
            
        build_data = {
            "shopId": self.shop_id,
            "title": "Test Build 2024",
            "vehicle": {
                "year": 2024,
                "make": "Toyota",
                "model": "Supra",
                "trim": "3.0"
            },
            "summary": "Test build for API testing",
            "status": "in-progress",
            "visibility": "public",
            "tags": ["test", "supra"]
        }
        
        success, response = self.run_test(
            "Create Build",
            "POST",
            "builds",
            200,
            data=build_data
        )
        
        if success and 'id' in response:
            self.build_id = response['id']
            self.log(f"   Created build ID: {self.build_id}")
            return True
        return False

    def test_get_build(self):
        """Test getting a build"""
        if not self.build_id:
            self.log("❌ Cannot get build - no build ID")
            return False
            
        success, response = self.run_test(
            "Get Build",
            "GET",
            f"builds/{self.build_id}",
            200
        )
        return success

    def test_list_builds(self):
        """Test listing builds"""
        success, response = self.run_test(
            "List Builds",
            "GET",
            "builds",
            200
        )
        
        if success and 'items' in response:
            self.log(f"   Found {len(response['items'])} builds")
            return True
        return False

    def test_search_parts(self):
        """Test parts search"""
        success, response = self.run_test(
            "Search Parts",
            "GET",
            "parts/search",
            200,
            data={"q": "exhaust"}
        )
        
        if success and 'items' in response:
            self.log(f"   Found {len(response['items'])} parts")
            if response['items']:
                self.part_id = response['items'][0]['id']
                self.log(f"   Using part ID: {self.part_id}")
            return True
        return False

    def test_link_part_to_build(self):
        """Test linking a part to a build"""
        if not self.build_id or not self.part_id:
            self.log("❌ Cannot link part - missing build or part ID")
            return False
            
        link_data = {
            "buildId": self.build_id,
            "partId": self.part_id,
            "orderIndex": 0
        }
        
        success, response = self.run_test(
            "Link Part to Build",
            "POST",
            f"builds/{self.build_id}/parts/link",
            200,
            data=link_data
        )
        return success

    def test_link_part_by_url(self):
        """Test linking part by URL"""
        if not self.build_id:
            self.log("❌ Cannot link part by URL - no build ID")
            return False
            
        url_data = {
            "buildId": self.build_id,
            "url": "https://example.com/product",
            "name": "Test Part from URL",
            "brand": "TestBrand"
        }
        
        success, response = self.run_test(
            "Link Part by URL",
            "POST",
            f"builds/{self.build_id}/parts/link-by-url",
            200,
            data=url_data
        )
        return success

    def test_get_build_parts(self):
        """Test getting build parts"""
        if not self.build_id:
            self.log("❌ Cannot get build parts - no build ID")
            return False
            
        success, response = self.run_test(
            "Get Build Parts",
            "GET",
            f"builds/{self.build_id}/parts",
            200
        )
        
        if success and 'items' in response:
            self.log(f"   Found {len(response['items'])} linked parts")
            return True
        return False

    def test_create_lead(self):
        """Test creating a lead"""
        if not self.build_id:
            self.log("❌ Cannot create lead - no build ID")
            return False
            
        lead_data = {
            "buildId": self.build_id,
            "contactName": "Test Customer",
            "email": "customer@test.com",
            "phone": "555-1234",
            "message": "Interested in this build",
            "source": "request_this_build"
        }
        
        success, response = self.run_test(
            "Create Lead",
            "POST",
            "leads",
            200,
            data=lead_data
        )
        return success

    def test_admin_get_leads(self):
        """Test admin getting leads"""
        # Switch to admin token
        current_token = self.token
        self.token = self.admin_token
        
        success, response = self.run_test(
            "Admin Get Leads",
            "GET",
            "admin/leads",
            200
        )
        
        # Restore original token
        self.token = current_token
        
        if success and 'items' in response:
            self.log(f"   Found {len(response['items'])} leads")
            return True
        return False

    def test_invoice_upload(self):
        """Test invoice PDF upload and parsing"""
        if not self.build_id:
            self.log("❌ Cannot upload invoice - no build ID")
            return False
            
        # Create a simple PDF content for testing
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Brembo Brake Pads $199.99 qty 1) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF"""
        
        # Create temporary PDF file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_content)
            tmp_file_path = tmp_file.name
        
        try:
            with open(tmp_file_path, 'rb') as f:
                files = {'file': ('test_invoice.pdf', f, 'application/pdf')}
                success, response = self.run_test(
                    "Upload Invoice PDF",
                    "POST",
                    f"builds/{self.build_id}/invoice/upload",
                    200,
                    files=files
                )
            
            if success and 'id' in response:
                invoice_id = response['id']
                self.log(f"   Uploaded invoice ID: {invoice_id}")
                
                # Test confirming invoice line items
                if 'lineItems' in response and response['lineItems']:
                    line_item_ids = [item['id'] for item in response['lineItems'][:2]]
                    confirm_success, _ = self.run_test(
                        "Confirm Invoice Line Items",
                        "POST",
                        f"invoices/{invoice_id}/confirm",
                        200,
                        data={"lineItemIds": line_item_ids}
                    )
                    return confirm_success
                return True
            return False
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_file_path)
            except:
                pass

    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting Buildboard API Tests")
        self.log(f"   Backend URL: {self.base_url}")
        
        # Test sequence
        tests = [
            ("Register New User", self.test_auth_register),
            ("Get Current User", self.test_auth_me),
            ("Create Shop", self.test_create_shop),
            ("Get My Shop", self.test_get_my_shop),
            ("Create Build", self.test_create_build),
            ("Get Build", self.test_get_build),
            ("List Builds", self.test_list_builds),
            ("Search Parts", self.test_search_parts),
            ("Link Part to Build", self.test_link_part_to_build),
            ("Link Part by URL", self.test_link_part_by_url),
            ("Get Build Parts", self.test_get_build_parts),
            ("Create Lead", self.test_create_lead),
            ("Admin Login", self.test_admin_login),
            ("Admin Get Leads", self.test_admin_get_leads),
            ("Upload Invoice", self.test_invoice_upload),
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log(f"❌ {test_name} - Exception: {str(e)}")
        
        # Print final results
        self.log("\n" + "="*50)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!")
            return 0
        else:
            self.log(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = BuildboardAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())