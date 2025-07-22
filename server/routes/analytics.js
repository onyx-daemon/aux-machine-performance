const express = require('express');
const mongoose = require('mongoose');
const ProductionRecord = require('../models/ProductionRecord');
const Machine = require('../models/Machine');
const Config = require('../models/Config');
const nodemailer = require('nodemailer');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get production timeline for a machine (7 days)
router.get('/production-timeline/:machineId', auth, async (req, res) => {
  try {
    const { machineId } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    // Check access permissions
    const machine = await Machine.findById(machineId).populate('departmentId');
    if (!machine) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    if (req.user.role === 'operator' && req.user.departmentId?._id.toString() !== machine.departmentId._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this machine' });
    }

    // Get production records
    const productionRecords = await ProductionRecord.find({
      machineId,
      startTime: { $gte: startDate, $lte: endDate }
    }).populate('operatorId moldId hourlyData.operatorId hourlyData.moldId');

    // Generate timeline data for the last 7 days
    const timeline = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayStart.getUTCDate() + 1);

      const dayData = {
        date: dayStart.toISOString().split('T')[0],
        hours: []
      };

      // Find production record for this day
      const dayRecord = productionRecords.find(record => {
        const recordDate = new Date(record.startTime);
        return recordDate.toDateString() === dayStart.toDateString();
      });

      for (let hour = 0; hour < 24; hour++) {
        const hourData = dayRecord?.hourlyData?.find(h => h.hour === hour);
        
        // Calculate running vs stoppage time
        const runningMinutes = hourData?.runningMinutes || 0;
        // Calculate stoppage minutes from actual stoppages
        const stoppageMinutes = hourData?.stoppages.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

        // Determine status based on activity
        let status = 'inactive';
        if (runningMinutes > 0) {
          status = stoppageMinutes > runningMinutes ? 'stoppage' : 'running';
        } else if (stoppageMinutes > 0) {
          status = 'stoppage';
        }

        dayData.hours.push({
          hour,
          unitsProduced: hourData?.unitsProduced || 0,
          defectiveUnits: hourData?.defectiveUnits || 0,
          status: hourData?.status || status,
          operator: hourData?.operatorId || dayRecord?.operatorId,
          mold: hourData?.moldId || dayRecord?.moldId,
          stoppages: hourData?.stoppages || [],
          runningMinutes,
          stoppageMinutes
        });
      }

      timeline.push(dayData);
    }

    res.json(timeline);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add stoppage record
router.post('/stoppage', auth, async (req, res) => {
  try {
    const { machineId, hour, date, reason, description, duration, pendingStoppageId, sapNotificationNumber } = req.body;
    const io = req.app.get('io');
    
    // Validate SAP notification number for breakdown
    if (reason === 'breakdown' && (!sapNotificationNumber || sapNotificationNumber.trim() === '')) {
      return res.status(400).json({ message: 'SAP notification number is required for breakdown stoppages' });
    }
    
    // Validate SAP notification number format (only numbers)
    if (reason === 'breakdown' && sapNotificationNumber && !/^\d+$/.test(sapNotificationNumber.trim())) {
      return res.status(400).json({ message: 'SAP notification number must contain only numbers' });
    }
    
    // Find production record for the specified date
    let productionRecord = await ProductionRecord.findOne({
      machineId,
      startTime: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      }
    });

    if (!productionRecord) {
      productionRecord = new ProductionRecord({
        machineId,
        startTime: new Date(date + 'T00:00:00.000Z'),
        hourlyData: []
      });
    }

    // Find or create hourly data
    let hourData = productionRecord.hourlyData.find(h => h.hour === hour);
    if (!hourData) {
      hourData = {
        hour,
        unitsProduced: 0,
        defectiveUnits: 0,
        status: 'stoppage',
        runningMinutes: 0,
        stoppageMinutes: 0,
        stoppages: []
      };
      productionRecord.hourlyData.push(hourData);
    }

    // If this is updating a pending stoppage, find and update it
    if (pendingStoppageId) {
      const stoppageIndex = hourData.stoppages.findIndex(s => 
        (s._id && s._id.toString() === pendingStoppageId) || s.reason === 'unclassified'
      );
      
      if (stoppageIndex >= 0) {
          const pendingStoppage = hourData.stoppages[stoppageIndex];
          
          // FIX: Replace currentTime with new Date()
          const actualDuration = Math.floor(
            (new Date() - pendingStoppage.startTime) / (1000 * 60)
          );
          
          // Update the existing pending stoppage
          hourData.stoppages[stoppageIndex].reason = reason;
          hourData.stoppages[stoppageIndex].description = description;
          hourData.stoppages[stoppageIndex].endTime = new Date();
          hourData.stoppages[stoppageIndex].duration = actualDuration; // Use actual duration
          
          if (reason === 'breakdown') {
            hourData.stoppages[stoppageIndex].sapNotificationNumber = sapNotificationNumber;
          }
          
          hourData.stoppages[stoppageIndex].isPending = false;
          hourData.stoppages[stoppageIndex].isClassified = true;
      } else {
        // If pending stoppage not found, create new one
        const stoppageStart = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
        const stoppageEnd = new Date(stoppageStart.getTime() + (duration * 60 * 1000));
        
        const newStoppage = {
          reason,
          description,
          startTime: stoppageStart,
          endTime: stoppageEnd,
          duration,
          isPending: false,
          isClassified: true
        };
        
        if (reason === 'breakdown') {
          newStoppage.sapNotificationNumber = sapNotificationNumber;
        }
        
        hourData.stoppages.push(newStoppage);
      }
    } else {
      // Add new stoppage
      const stoppageStart = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
      const stoppageEnd = new Date(stoppageStart.getTime() + (duration * 60 * 1000));
      
      const newStoppage = {
        reason,
        description,
        startTime: stoppageStart,
        endTime: stoppageEnd,
        duration,
        isPending: false,
        isClassified: true
      };
      
      if (reason === 'breakdown') {
        newStoppage.sapNotificationNumber = sapNotificationNumber;
      }
      
      hourData.stoppages.push(newStoppage);

      hourData.stoppageMinutes = hourData.stoppages.reduce((sum, s) => sum + (s.duration || 0), 0);
    }

    // Set status based on reason with specific colors
    if (reason === 'breakdown') {
      hourData.status = 'stoppage';
    } else {
      hourData.status = 'stoppage';
    }

    await productionRecord.save();

    // Send email notification for breakdown stoppages
    if (reason === 'breakdown') {
      try {
        await sendBreakdownNotification({
          machineId,
          machineName: (await Machine.findById(machineId))?.name || 'Unknown Machine',
          sapNotificationNumber,
          description,
          duration,
          startTime: new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`),
          reportedBy: req.user.username
        });
      } catch (emailError) {
        console.error('Failed to send breakdown notification email:', emailError);
        // Don't fail the request if email fails
      }
    }
    // Emit socket event
    io.emit('stoppage-added', {
      machineId,
      hour,
      date,
      stoppage: {
        reason,
        description,
        duration,
        sapNotificationNumber
      },
      timestamp: new Date()
    });

    res.status(201).json({ message: 'Stoppage recorded successfully' });
  } catch (error) {
    console.error('Error saving stoppage:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update production assignment
router.post('/production-assignment', auth, async (req, res) => {
  try {
    const { machineId, hour, date, operatorId, moldId, defectiveUnits, applyToShift } = req.body;
    const io = req.app.get('io');
    
    // Validate and convert operatorId to ObjectId if provided
    let validOperatorId = null;
    
    if (operatorId && operatorId.trim() !== '') {
      // Check if it's already a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(operatorId)) {
        validOperatorId = new mongoose.Types.ObjectId(operatorId);
      } else {
        // Try to find user by username
        const User = require('../models/User');
        const user = await User.findOne({ username: operatorId });
        if (user) {
          validOperatorId = user._id;
        } else {
          return res.status(400).json({ message: 'Invalid operator specified' });
        }
      }
    }

    // Validate and convert moldId to ObjectId if provided
    let validMoldId = null;
    if (moldId && moldId.trim() !== '') {
      if (mongoose.Types.ObjectId.isValid(moldId)) {
        validMoldId = new mongoose.Types.ObjectId(moldId);
      } else {
        return res.status(400).json({ message: 'Invalid mold ID specified' });
      }
    }
    
    // Find production record
    let productionRecord = await ProductionRecord.findOne({
      machineId,
      startTime: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      }
    });

    if (!productionRecord) {
      productionRecord = new ProductionRecord({
        machineId,
        startTime: new Date(date + 'T00:00:00.000Z'),
        hourlyData: []
      });
    }

    // Get shift configuration
    const config = await Config.findOne();
    const shifts = config?.shifts || [];
    
    // Determine hours to update
    let hoursToUpdate = [hour];
    if (applyToShift) {
      // Find shift that contains the current hour
      const shift = shifts.find(s => {
        const startHour = parseInt(s.startTime.split(':')[0]);
        const endHour = parseInt(s.endTime.split(':')[0]);
        
        if (startHour <= endHour) {
          return hour >= startHour && hour < endHour;
        } else {
          return hour >= startHour || hour < endHour;
        }
      });

      if (applyToShift && shift) {
        const startHour = parseInt(shift.startTime.split(':')[0]);
        const endHour = parseInt(shift.endTime.split(':')[0]);
        
        hoursToUpdate = [];
        
        if (startHour <= endHour) {
          for (let h = startHour; h < endHour; h++) {
            hoursToUpdate.push(h);
          }
        } else {
          // Night shift (crosses midnight)
          if (hour >= startHour) {
            // First part (current day)
            for (let h = startHour; h < 24; h++) {
              hoursToUpdate.push(h);
            }
          } else if (hour < endHour) {
            // Second part (current day)
            for (let h = 0; h < endHour; h++) {
              hoursToUpdate.push(h);
            }
          }
        }
      }
    }

    // Update each hour in the range
    for (const targetHour of hoursToUpdate) {
      // Find or create hourly data
      let hourData = productionRecord.hourlyData.find(h => h.hour === targetHour);
      if (!hourData) {
        hourData = {
          hour: targetHour,
          unitsProduced: 0,
          defectiveUnits: 0,
          status: 'inactive',
          runningMinutes: 0,
          stoppageMinutes: 0,
          stoppages: [],
        };

        if (validOperatorId) hourData.operatorId = validOperatorId;
        if (validMoldId) hourData.moldId = validMoldId;

        productionRecord.hourlyData.push(hourData);
      }

      
      // Only update defective units for the original hour
      if (targetHour === hour && defectiveUnits !== undefined) {
        hourData.defectiveUnits = defectiveUnits;
      }
    }

    productionRecord.markModified('hourlyData');

    // Update total defective units
    productionRecord.defectiveUnits = productionRecord.hourlyData.reduce(
      (sum, h) => sum + (h.defectiveUnits || 0), 0
    );

    await productionRecord.save();

    // Emit socket event
    io.emit('production-assignment-updated', {
      machineId,
      hours: hoursToUpdate,
      date,
      operatorId: validOperatorId,
      moldId: validMoldId,
      originalHour: hour,
      defectiveUnits: hour === hour ? defectiveUnits : undefined,
      timestamp: new Date()
    });

    res.json({ message: 'Production assignment updated successfully' });
  } catch (error) {
    console.error('Error saving assignment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get machine statistics
router.get('/machine-stats/:machineId', auth, async (req, res) => {
  try {
    const { machineId } = req.params;
    const { period = '24h' } = req.query;

    // Check access permissions
    const machine = await Machine.findById(machineId).populate('departmentId');
    if (!machine) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    if (req.user.role === 'operator' && req.user.departmentId?._id.toString() !== machine.departmentId._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this machine' });
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    
    if (period === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    }

    // Calculate production statistics
    const productionRecords = await ProductionRecord.find({
      machineId,
      startTime: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'hourlyData.moldId',
      model: 'Mold'
    });


    const totalUnitsProduced = productionRecords.reduce((sum, record) => 
      sum + record.unitsProduced, 0
    );

    const totalDefectiveUnits = productionRecords.reduce((sum, record) => 
      sum + record.defectiveUnits, 0
    );

    // Calculate time-based metrics and breakdown-specific metrics
    let totalRunningMinutes = 0;
    let totalStoppageMinutes = 0;
    let totalStoppages = 0;
    let breakdownStoppages = 0;
    let totalBreakdownMinutes = 0;
    let totalExpectedUnits = 0;

     productionRecords.forEach(record => {
      record.hourlyData.forEach(hourData => {
        totalRunningMinutes += hourData.runningMinutes || 0;
        totalStoppageMinutes += hourData.stoppageMinutes || 0;
        totalStoppages += hourData.stoppages?.length || 0;

        // Calculate expected units based on ACTUAL RUNNING TIME
        if (hourData.moldId?.productionCapacityPerHour) {
          const capacityPerMinute = hourData.moldId.productionCapacityPerHour / 60;
          totalExpectedUnits += capacityPerMinute * (hourData.runningMinutes || 0);
        }

        // Count breakdown stoppages
        hourData.stoppages?.forEach(stoppage => {
          if (stoppage.reason === 'breakdown') {
            breakdownStoppages++;
            totalBreakdownMinutes += stoppage.duration || 0;
          }
        });
      });
    });


    // Calculate availability
    const totalAvailableMinutes = totalRunningMinutes + totalStoppageMinutes;
    const availability = totalAvailableMinutes > 0 
      ? (totalRunningMinutes / totalAvailableMinutes)
      : 0;
    
    // Calculate quality: Goods without defect / total goods * 100
    const quality = totalUnitsProduced > 0 ? (totalUnitsProduced - totalDefectiveUnits) / totalUnitsProduced : 0;
    
    productionRecords.forEach(record => {
      record.hourlyData.forEach(hourData => {
        if (hourData.moldId && hourData.moldId.productionCapacityPerHour) {
          totalExpectedUnits += hourData.moldId.productionCapacityPerHour;
        }
      });
    });

    // Then calculate performance:
    const performance = totalExpectedUnits > 0 
      ? (totalUnitsProduced / totalExpectedUnits)
      : 0;
    
    const oee = availability * quality * performance;

    // Calculate MTBF and MTTR based on breakdown stoppages only
    const mtbf = breakdownStoppages > 0 ? totalRunningMinutes / breakdownStoppages : 0;
    const mttr = breakdownStoppages > 0 ? totalBreakdownMinutes / breakdownStoppages : 0;

    res.json({
      totalUnitsProduced,
      totalDefectiveUnits,
      oee: Math.round(oee * 100),
      mtbf: Math.round(mtbf), // in minutes
      mttr: Math.round(mttr), // in minutes
      availability: Math.round(availability * 100),
      quality: Math.round(quality * 100),
      performance: Math.round(performance * 100),
      currentStatus: machine.status,
      totalRunningMinutes,
      totalStoppageMinutes,
      breakdownStoppages,
      totalBreakdownMinutes
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Email notification function for breakdowns
async function sendBreakdownNotification(breakdownData) {
  try {
    const config = await Config.findOne();
    if (!config || !config.email.recipients.length) {
      console.log('No email configuration found for breakdown notification');
      return;
    }

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: config.email.senderEmail,
        pass: config.email.senderPassword
      }
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🚨 BREAKDOWN ALERT</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Immediate attention required</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #1e293b; margin-top: 0;">Breakdown Details</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: #ffffff;">
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Machine:</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${breakdownData.machineName}</td>
            </tr>
            <tr style="background: #f1f5f9;">
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">SAP Notification:</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${breakdownData.sapNotificationNumber}</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Start Time:</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${breakdownData.startTime.toLocaleString()}</td>
            </tr>
            <tr style="background: #f1f5f9;">
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Duration:</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #dc2626;">${breakdownData.duration} minutes</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Reported By:</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${breakdownData.reportedBy}</td>
            </tr>
          </table>
          
          ${breakdownData.description ? `
            <div style="background: #ffffff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1e293b;">Description:</h3>
              <p style="margin: 0; color: #475569; line-height: 1.5;">${breakdownData.description}</p>
            </div>
          ` : ''}
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0;">⚡ Action Required</h3>
            <p style="margin: 0; color: #7f1d1d;">
              This breakdown requires immediate attention. Please coordinate with the maintenance team and update the SAP system accordingly.
            </p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Generated by Dawlance LineSentry System<br>
              ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: config.email.senderEmail,
      to: config.email.recipients.join(','),
      subject: `🚨 BREAKDOWN ALERT - ${breakdownData.machineName} - SAP: ${breakdownData.sapNotificationNumber}`,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);
    console.log(`Breakdown notification sent for machine ${breakdownData.machineName}`);
  } catch (error) {
    console.error('Error sending breakdown notification:', error);
    throw error;
  }
}

module.exports = router;