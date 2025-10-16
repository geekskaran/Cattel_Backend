const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Report Generator Utility
 * Generates Excel and CSV reports for admins
 * As per document: Regional and Super admins can download reports
 */

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.ensureReportsDirectory();
  }

  /**
   * Ensure reports directory exists
   */
  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate Farmers Report
   * @param {Array} farmers - Array of farmer/user data
   * @param {string} region - Region name (optional)
   * @returns {string} - File path
   */
  async generateFarmersReport(farmers, region = 'All') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Farmers Report');

    // Set column headers
    worksheet.columns = [
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Occupation', key: 'occupation', width: 20 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Pin Code', key: 'pinCode', width: 10 },
      { header: 'Total Cattle', key: 'totalCattle', width: 12 },
      { header: 'Email Verified', key: 'emailVerified', width: 15 },
      { header: 'Mobile Verified', key: 'mobileVerified', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Registered Date', key: 'registeredDate', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    // Add data rows
    farmers.forEach(farmer => {
      worksheet.addRow({
        userId: farmer._id.toString(),
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        email: farmer.email,
        mobileNumber: farmer.mobileNumber,
        dob: farmer.dateOfBirth ? new Date(farmer.dateOfBirth).toLocaleDateString() : '',
        occupation: farmer.occupation,
        district: farmer.address?.district || '',
        state: farmer.address?.state || '',
        pinCode: farmer.address?.pinCode || '',
        totalCattle: farmer.cattle?.length || 0,
        emailVerified: farmer.isEmailVerified ? 'Yes' : 'No',
        mobileVerified: farmer.isMobileVerified ? 'Yes' : 'No',
        status: farmer.isActive ? 'Active' : 'Inactive',
        registeredDate: new Date(farmer.createdAt).toLocaleString()
      });
    });

    // Add summary at the bottom
    worksheet.addRow({});
    const summaryRow = worksheet.addRow({
      userId: 'TOTAL',
      firstName: farmers.length,
      lastName: 'farmers registered'
    });
    summaryRow.font = { bold: true };

    // Generate filename
    const timestamp = Date.now();
    const filename = `Farmers_Report_${region}_${timestamp}.xlsx`;
    const filePath = path.join(this.reportsDir, filename);

    // Save file
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Farmers report generated: ${filename}`);

    return filePath;
  }

  /**
   * Generate Cattle Report
   * @param {Array} cattle - Array of cattle data
   * @param {string} region - Region name (optional)
   * @returns {string} - File path
   */
  async generateCattleReport(cattle, region = 'All') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cattle Report');

    // Set column headers
    worksheet.columns = [
      { header: 'Cattle ID', key: 'cattleId', width: 20 },
      { header: 'Owner Name', key: 'ownerName', width: 25 },
      { header: 'Owner Mobile', key: 'ownerMobile', width: 15 },
      { header: 'Breed', key: 'breed', width: 20 },
      { header: 'Tag No', key: 'tagNo', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Verification Status', key: 'verificationStatus', width: 20 },
      { header: 'Verified By', key: 'verifiedBy', width: 25 },
      { header: 'Registered Date', key: 'registeredDate', width: 20 },
      { header: 'Verified Date', key: 'verifiedDate', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2196F3' }
    };

    // Add data rows
    cattle.forEach(cow => {
      worksheet.addRow({
        cattleId: cow.cattleId,
        ownerName: cow.owner ? `${cow.owner.firstName} ${cow.owner.lastName}` : 'N/A',
        ownerMobile: cow.owner?.mobileNumber || 'N/A',
        breed: cow.breed,
        tagNo: cow.tagNo || 'N/A',
        age: cow.age,
        type: cow.type || 'N/A',
        color: cow.color || 'N/A',
        district: cow.location?.district || '',
        state: cow.location?.state || '',
        status: cow.status,
        verificationStatus: cow.verification?.status || 'pending',
        verifiedBy: cow.verification?.verifiedBy ? 
          `${cow.verification.verifiedBy.firstName} ${cow.verification.verifiedBy.lastName}` : 'N/A',
        registeredDate: new Date(cow.createdAt).toLocaleString(),
        verifiedDate: cow.verification?.verifiedAt ? new Date(cow.verification.verifiedAt).toLocaleString() : 'N/A'
      });
    });

    // Add summary
    worksheet.addRow({});
    const summaryRow = worksheet.addRow({
      cattleId: 'TOTAL',
      ownerName: cattle.length,
      ownerMobile: 'cattle registered'
    });
    summaryRow.font = { bold: true };

    // Count by status
    const statusCounts = cattle.reduce((acc, cow) => {
      acc[cow.status] = (acc[cow.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      worksheet.addRow({
        cattleId: status.toUpperCase(),
        ownerName: count
      });
    });

    // Generate filename
    const timestamp = Date.now();
    const filename = `Cattle_Report_${region}_${timestamp}.xlsx`;
    const filePath = path.join(this.reportsDir, filename);

    // Save file
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Cattle report generated: ${filename}`);

    return filePath;
  }

  /**
   * Generate Combined Report (Farmers + Cattle)
   * @param {Array} farmers - Array of farmer data
   * @param {Array} cattle - Array of cattle data
   * @param {string} region - Region name
   * @returns {string} - File path
   */
  async generateCombinedReport(farmers, cattle, region = 'All') {
    const workbook = new ExcelJS.Workbook();

    // Farmers Sheet
    const farmersSheet = workbook.addWorksheet('Farmers');
    farmersSheet.columns = [
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Total Cattle', key: 'totalCattle', width: 12 },
      { header: 'Status', key: 'status', width: 10 }
    ];

    farmersSheet.getRow(1).font = { bold: true };
    farmersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    farmers.forEach(farmer => {
      farmersSheet.addRow({
        userId: farmer._id.toString(),
        name: `${farmer.firstName} ${farmer.lastName}`,
        email: farmer.email,
        mobile: farmer.mobileNumber,
        district: farmer.address?.district || '',
        state: farmer.address?.state || '',
        totalCattle: farmer.cattle?.length || 0,
        status: farmer.isActive ? 'Active' : 'Inactive'
      });
    });

    // Cattle Sheet
    const cattleSheet = workbook.addWorksheet('Cattle');
    cattleSheet.columns = [
      { header: 'Cattle ID', key: 'cattleId', width: 20 },
      { header: 'Owner', key: 'owner', width: 25 },
      { header: 'Breed', key: 'breed', width: 20 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Verification', key: 'verification', width: 15 }
    ];

    cattleSheet.getRow(1).font = { bold: true };
    cattleSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2196F3' }
    };

    cattle.forEach(cow => {
      cattleSheet.addRow({
        cattleId: cow.cattleId,
        owner: cow.owner ? `${cow.owner.firstName} ${cow.owner.lastName}` : 'N/A',
        breed: cow.breed,
        age: cow.age,
        district: cow.location?.district || '',
        status: cow.status,
        verification: cow.verification?.status || 'pending'
      });
    });

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Count', key: 'count', width: 15 }
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9800' }
    };

    summarySheet.addRow({ metric: 'Total Farmers', count: farmers.length });
    summarySheet.addRow({ metric: 'Total Cattle', count: cattle.length });
    summarySheet.addRow({ 
      metric: 'Active Cattle', 
      count: cattle.filter(c => c.status === 'active').length 
    });
    summarySheet.addRow({ 
      metric: 'Pending Verification', 
      count: cattle.filter(c => c.verification?.status === 'pending').length 
    });

    // Generate filename
    const timestamp = Date.now();
    const filename = `Combined_Report_${region}_${timestamp}.xlsx`;
    const filePath = path.join(this.reportsDir, filename);

    // Save file
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Combined report generated: ${filename}`);

    return filePath;
  }

  /**
   * Generate CSV Report
   * @param {Array} data - Data array
   * @param {Array} headers - Column headers
   * @param {string} filename - Output filename
   * @returns {string} - File path
   */
  async generateCSVReport(data, headers, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.columns = headers;
    
    data.forEach(row => {
      worksheet.addRow(row);
    });

    const timestamp = Date.now();
    const csvFilename = `${filename}_${timestamp}.csv`;
    const filePath = path.join(this.reportsDir, csvFilename);

    await workbook.csv.writeFile(filePath);
    console.log(`✅ CSV report generated: ${csvFilename}`);

    return filePath;
  }

  /**
   * Delete old report files
   * @param {number} daysOld - Delete files older than this many days
   */
  cleanupOldReports(daysOld = 7) {
    const files = fs.readdirSync(this.reportsDir);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    console.log(`✅ Cleaned up ${deletedCount} old report files`);
    return deletedCount;
  }
}

module.exports = new ReportGenerator();