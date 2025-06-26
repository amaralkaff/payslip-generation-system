## **Background Context**

In a company, there is data that contains employees' salaries. They're paid with the same rule, which is monthly-based, with regular 8 working hours per day (9AM-5PM), 5 days a week (monday-friday). Their take-home pay will be prorated based on their attendance. Along with that, they can also propose overtime, which is paid at twice the prorated salary for hours taken. They can also submit reimbursement requests which will be included in the payslip.

## **Objective**

Create a scalable payslip generation system that can handle predefined rules for employee attendance, overtime, and reimbursement.

## **Requirements**

* Create 100 fake employees in the database, each prefilled with various salary, username, and password.  
* Create 1 fake admin in the database, prefilled with username and password.  
* Create an endpoint where admin can add attendance period start & end date for particular payroll.  
* Create an endpoint where employees can submit their own attendance.  
  * No rules for late or early check-ins or check-outs; check-in at any time that day counts.  
  * Submissions on the same day should count as one.  
  * Users cannot submit on weekends.  
* Create an endpoint where employees can submit overtime.  
  * Overtime must be proposed after they are done working.  
  * They can submit the number of hours taken for that overtime.  
  * Overtime cannot be more than 3 hours per day.  
  * Overtime can be taken any day.  
* Create an endpoint where employees can submit reimbursements.  
  * Employees can attach the amount of money that needs to be reimbursed.  
  * Employees can attach a description to that reimbursement.  
* Create an endpoint where admin can run payroll (process payments to employees).  
  * Once payroll is run, attendance, overtime, and reimbursement records from that period cannot affect the payslip.  
  * Payroll for each attendance period can only be run once.  
* Create an endpoint where employees can generate a payslip.  
  * Payslip contains a breakdown of their attendance and how it affects the salary.  
  * Payslip contains a breakdown of their overtime and how much it is multiplied by the salary.  
  * Payslip contains a list of reimbursements.  
  * Payslip contains the total take-home pay, which is an accumulation of all components.  
* Create an endpoint where admin can generate a summary of all employee payslips.  
  * The summary contains take-home pay of each employee.  
  * The summary contains the total take-home pay of all employees.

## **Technical Requirements**

* Use PostgreSQL as the main database.  
* Handle API requests via HTTP using JSON as the data format.  
* Implement automated testing (unit tests, integration tests, or both) for all functionality.  
* Provide clear documentation covering how-to guides, API usage, and software architecture.  
* Submit the code to a public GitHub repository.

## **Plus Points**

* Measure performance scalability of each functionality.  
* Ensure that every record is tracable.  
  * Each record should include created\_at and updated\_at timestamps.  
  * Track the user who performed each action (created\_by, updated\_by).  
  * Store the IP address of requests for audit purposes.  
  * Maintain an audit log table to track significant changes to records.  
  * Include request\_id in logs for request tracing across services.


![Coverage](coverege.png)

## **How to Run**

### **Prerequisites**
- Node.js (v16 or higher)
- PostgreSQL database

### **Quick Start**
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Setup database
npm run migrate
npm run seed

# 4. Start server
npm run start:minimal

# 5. Open API documentation
open http://localhost:3000/api-docs
```

### **Demo Credentials**
- **Admin**: `admin` / `admin123`
- **Employee**: `employee001` / `emp001pass` (and employee002-employee100)

### **API Testing via Swagger UI**
1. **Open Swagger**: http://localhost:3000/api-docs
2. **Login first**: Use POST `/api/v1/auth/login` with auto-filled demo credentials
3. **Get JWT token**: Copy the `token` from login response
4. **Authorize**: Click 🔒 **"Authorize"** button at top right
5. **Enter token**: Type `Bearer <your-jwt-token>` (include "Bearer " prefix)
6. **Test APIs**: All endpoints now have **auto-placeholder values** - just click "Execute"!

**✨ Enhanced Features:**
- **Auto-filled forms**: All request bodies pre-populated with realistic data
- **Multiple examples**: Choose from different scenarios (Admin/Employee login, Travel/Meals reimbursement)
- **Smart defaults**: Dates automatically set for July 2025 period
- **One-click testing**: No manual typing needed - just click "Execute"

**Step-by-step Authorization:**
```
1. POST /api/v1/auth/login → Auto-filled with admin/admin123
2. Click "Authorize" button in Swagger UI
3. Enter: Bearer <token-from-step-1>
4. Click "Authorize" 
5. Test any endpoint - all forms auto-populated!
```

## **API Usage Guide**

### **1. Authentication**
```bash
# Login as Admin
POST /api/v1/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# Login as Employee
POST /api/v1/auth/login
{
  "username": "employee001",
  "password": "emp001pass"
}
```

### **2. Admin - Create Attendance Period**
```bash
POST /api/v1/admin/attendance-periods
Authorization: Bearer <admin_jwt_token>
{
  "name": "July 2025",
  "start_date": "2025-07-01",
  "end_date": "2025-07-31"
}
```

### **3. Employee - Submit Attendance**
```bash
POST /api/v1/employee/attendance
Authorization: Bearer <employee_jwt_token>
{
  "attendance_date": "2025-06-26",
  "notes": "Regular work day"
}
```

### **4. Employee - Submit Overtime**
```bash
POST /api/v1/employee/overtime
Authorization: Bearer <employee_jwt_token>
{
  "overtime_date": "2025-06-26",
  "hours_worked": 2.5,
  "description": "Project deadline work"
}
```

### **5. Employee - Submit Reimbursement**
```bash
POST /api/v1/employee/reimbursements
Authorization: Bearer <employee_jwt_token>
{
  "amount": 150.75,
  "description": "Travel expenses for client meeting",
  "category": "travel"
}
```

### **6. Admin - Process Payroll**
```bash
POST /api/v1/admin/payroll/process
Authorization: Bearer <admin_jwt_token>
{
  "attendance_period_id": 1
}
```

### **7. Employee - Generate Payslip**
```bash
GET /api/v1/employee/payslip/1
Authorization: Bearer <employee_jwt_token>
```

### **8. Admin - Get Payroll Summary**
```bash
GET /api/v1/admin/payroll/summary/1
Authorization: Bearer <admin_jwt_token>
```

### **Complete Workflow Example**
```bash
# 1. Admin login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Employee login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"employee001","password":"emp001pass"}'

# 3. Employee submits attendance (repeat for multiple days)
curl -X POST http://localhost:3000/api/v1/employee/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <employee_token>" \
  -d '{"attendance_date":"2025-06-26","notes":"Regular work"}'

# 4. Employee submits overtime
curl -X POST http://localhost:3000/api/v1/employee/overtime \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <employee_token>" \
  -d '{"overtime_date":"2025-06-26","hours_worked":2,"description":"Extra work"}'

# 5. Employee submits reimbursement
curl -X POST http://localhost:3000/api/v1/employee/reimbursements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <employee_token>" \
  -d '{"amount":100,"description":"Travel cost"}'

# 6. Admin processes payroll
curl -X POST http://localhost:3000/api/v1/admin/payroll/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"attendance_period_id":1}'

# 7. Employee generates payslip
curl -X GET http://localhost:3000/api/v1/employee/payslip/1 \
  -H "Authorization: Bearer <employee_token>"

# 8. Admin gets summary
curl -X GET http://localhost:3000/api/v1/admin/payroll/summary/1 \
  -H "Authorization: Bearer <admin_token>"
```

### **Testing Commands**
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Test with coverage
npm run test:coverage
```

