-- 04 · Data-quality checks.
-- Each check is one query that returns the number of rows that break the rule. 0 means PASS.
-- Header format:  -- check: name | severity | description
--   ERROR  the pipeline fails            WARN  reported, the pipeline continues

-- check: employees_reconcile | ERROR | Every employee row received is either in silver or in the reject table
SELECT ABS((SELECT COUNT(*) FROM bronze.employees) - (SELECT COUNT(*) FROM silver.employee)
         - (SELECT COUNT(*) FROM silver.reject WHERE source = 'employees'));
GO
-- check: attendance_reconcile | ERROR | Every attendance row received is either in silver or in the reject table
SELECT ABS((SELECT COUNT(*) FROM bronze.attendance) - (SELECT COUNT(*) FROM silver.attendance)
         - (SELECT COUNT(*) FROM silver.reject WHERE source = 'attendance'));
GO
-- check: payroll_reconcile | ERROR | Every payroll row received is either in silver or in the reject table
SELECT ABS((SELECT COUNT(*) FROM bronze.payroll) - (SELECT COUNT(*) FROM silver.payroll)
         - (SELECT COUNT(*) FROM silver.reject WHERE source = 'payroll'));
GO
-- check: employee_unique | ERROR | A staff number appears once in the employee dimension
SELECT COUNT(*) FROM (SELECT StaffNo FROM gold.DimEmployee GROUP BY StaffNo HAVING COUNT(*) > 1) d;
GO
-- check: attendance_has_employee | ERROR | Every attendance fact points to an existing employee
SELECT COUNT(*) FROM gold.FactAttendance f LEFT JOIN gold.DimEmployee e ON e.EmployeeKey = f.EmployeeKey
WHERE e.EmployeeKey IS NULL;
GO
-- check: attendance_has_date | ERROR | Every attendance fact points to an existing date
SELECT COUNT(*) FROM gold.FactAttendance f LEFT JOIN gold.DimDate d ON d.DateKey = f.DateKey
WHERE d.DateKey IS NULL;
GO
-- check: payroll_has_employee | ERROR | Every payroll fact points to an existing employee
SELECT COUNT(*) FROM gold.FactPayroll f LEFT JOIN gold.DimEmployee e ON e.EmployeeKey = f.EmployeeKey
WHERE e.EmployeeKey IS NULL;
GO
-- check: payroll_total_matches | ERROR | Total net pay in gold equals total net pay in silver
SELECT CASE WHEN ABS((SELECT COALESCE(SUM(Net), 0) FROM gold.FactPayroll)
                   - (SELECT COALESCE(SUM(net), 0) FROM silver.payroll)) > 0.01 THEN 1 ELSE 0 END;
GO
-- check: attendance_rows_match | ERROR | Gold has the same number of attendance rows as silver
SELECT ABS((SELECT COUNT(*) FROM gold.FactAttendance) - (SELECT COUNT(*) FROM silver.attendance));
GO
-- check: hours_in_range | ERROR | Hours worked in a day are between 0 and 16
SELECT COUNT(*) FROM gold.FactAttendance WHERE HoursWorked < 0 OR HoursWorked > 16;
GO
-- check: payroll_one_currency_per_month | WARN | A month is paid in a single currency
SELECT COUNT(*) FROM (SELECT MonthKey FROM gold.FactPayroll GROUP BY MonthKey HAVING COUNT(DISTINCT Currency) > 1) m;
GO
-- check: attendance_incomplete | WARN | Attendance rows without a check-out
SELECT COUNT(*) FROM gold.FactAttendance WHERE IsIncomplete = 1;
GO
-- check: gender_unknown | WARN | Employees whose gender is not recorded
SELECT COUNT(*) FROM gold.DimEmployee WHERE Gender = 'U';
GO
-- check: employees_without_pay | WARN | Employees with no payroll row in the latest month
SELECT COUNT(*) FROM gold.DimEmployee e
WHERE NOT EXISTS (SELECT 1 FROM gold.FactPayroll f
                  WHERE f.EmployeeKey = e.EmployeeKey AND f.MonthKey = (SELECT MAX(MonthKey) FROM gold.FactPayroll));
GO
-- check: rejected_rows | WARN | Rows rejected during cleaning (see silver.reject for the reasons)
SELECT COUNT(*) FROM silver.reject WHERE reason <> 'duplicate';
GO
