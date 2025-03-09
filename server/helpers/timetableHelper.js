const { CoursePage } = require("./courseHelper");
const {
  Slot,
  Batch,
  TableSlot,
  DaySchedule,
  TimetableResult,
} = require("../types/timetable");

const slotTimes = [
  "08:00-08:50",
  "08:50-09:40",
  "09:45-10:35",
  "10:40-11:30",
  "11:35-12:25",
  "12:30-13:20",
  "13:25-14:15",
  "14:20-15:10",
  "15:10-16:00",
  "16:00-16:50",
];

const batch1 = {
  batch: "1",
  slots: [
    {
      day: 1,
      dayOrder: "Day 1",
      slots: ["A", "A", "F", "F", "G", "P6", "P7", "P8", "P9", "P10"],
      times: slotTimes,
    },
    {
      day: 2,
      dayOrder: "Day 2",
      slots: ["P11", "P12", "P13", "P14", "P15", "B", "B", "G", "G", "A"],
      times: slotTimes,
    },
    {
      day: 3,
      dayOrder: "Day 3",
      slots: ["C", "C", "A", "D", "B", "P26", "P27", "P28", "P29", "P30"],
      times: slotTimes,
    },
    {
      day: 4,
      dayOrder: "Day 4",
      slots: ["P31", "P32", "P33", "P34", "P35", "D", "D", "B", "E", "C"],
      times: slotTimes,
    },
    {
      day: 5,
      dayOrder: "Day 5",
      slots: ["E", "E", "C", "F", "D", "P46", "P47", "P48", "P49", "P50"],
      times: slotTimes,
    },
  ],
};

const batch2 = {
  batch: "2",
  slots: [
    {
      day: 1,
      dayOrder: "Day 1",
      slots: ["P1", "P2", "P3", "P4", "P5", "A", "A", "F", "F", "G"],
      times: slotTimes,
    },
    {
      day: 2,
      dayOrder: "Day 2",
      slots: ["B", "B", "G", "G", "A", "P16", "P17", "P18", "P19", "P20"],
      times: slotTimes,
    },
    {
      day: 3,
      dayOrder: "Day 3",
      slots: ["P21", "P22", "P23", "P24", "P25", "C", "C", "A", "D", "B"],
      times: slotTimes,
    },
    {
      day: 4,
      dayOrder: "Day 4",
      slots: ["D", "D", "B", "E", "C", "P36", "P37", "P38", "P39", "P40"],
      times: slotTimes,
    },
    {
      day: 5,
      dayOrder: "Day 5",
      slots: ["P41", "P42", "P43", "P44", "P45", "E", "E", "C", "F", "D"],
      times: slotTimes,
    },
  ],
};

class Timetable {
  constructor(cookie) {
    this.cookie = cookie;
  }

  async getTimetable(batchNumber) {
    try {
      const coursePage = new CoursePage(this.cookie);
      const courseList = await coursePage.getCourses();

      if (!courseList || courseList.error) {
        throw new Error(courseList.error || "Failed to get courses");
      }

      let selectedBatch;
      switch (parseInt(batchNumber)) {
        case 1:
          selectedBatch = batch1;
          break;
        case 2:
          selectedBatch = batch2;
          break;
        default:
          throw new Error(`Invalid batch number: ${batchNumber}`);
      }

      const mappedSchedule = this.mapSlotsToSubjects(
        selectedBatch,
        courseList.courses
      );

      return {
        regNumber: courseList.regNumber,
        batch: selectedBatch.batch,
        schedule: mappedSchedule,
      };
    } catch (error) {
      console.error("Error in getTimetable:", error);
      throw error;
    }
  }

  convertTo12Hour(time24) {
    const [hours, minutes] = time24.split(":").map(Number);

    const period = hours >= 12 ? "PM" : "AM";

    const hours12 = hours % 12 || 12;

    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  }

  getSlotsFromRange(slotRange) {
    return slotRange.split("-");
  }

  mapSlotsToSubjects(batch, subjects) {
    const slotMapping = {};

    for (const subject of subjects) {
      let slots = [];
      if (subject.slot && subject.slot.includes("-")) {
        slots = this.getSlotsFromRange(subject.slot);
      } else if (subject.slot) {
        slots = [subject.slot];
      }

      const isOnline =
        subject.room && subject.room.toLowerCase().includes("online");
      const slotType = !isOnline ? subject.slotType : "Practical";

      for (const slot of slots) {
        const tableSlot = {
          code: subject.code,
          name: subject.title,
          online: isOnline,
          courseType: slotType,
          roomNo: subject.room,
          slot: slot,
        };

        if (!slotMapping[slot]) {
          slotMapping[slot] = [];
        }
        slotMapping[slot].push(tableSlot);
      }
    }

    const schedule = [];

    for (const day of batch.slots) {
      const dayClasses = [];

      for (let i = 0; i < day.slots.length; i++) {
        const slotCode = day.slots[i];

        if (!slotMapping[slotCode]) continue;

        const timeRange = day.times[i];
        const [startTime24, endTime24] = timeRange.split("-");
        const startTime = this.convertTo12Hour(startTime24);
        const endTime = this.convertTo12Hour(endTime24);

        const subjectsInSlot = slotMapping[slotCode];

        if (subjectsInSlot.length > 1) {
          const mergedClass = {
            code: this.uniqueCodes(subjectsInSlot).join("/"),
            name: this.uniqueNames(subjectsInSlot).join("/"),
            online: subjectsInSlot[0].online,
            courseType: subjectsInSlot[0].courseType,
            roomNo: this.uniqueRooms(subjectsInSlot).join("/"),
            slot: slotCode,
            startTime,
            endTime,
            timeSlot: `${startTime}-${endTime}`,
          };
          dayClasses.push(mergedClass);
        } else {
          const classEntry = {
            ...subjectsInSlot[0],
            startTime,
            endTime,
            timeSlot: `${startTime}-${endTime}`,
          };
          dayClasses.push(classEntry);
        }
      }

      if (dayClasses.length > 0) {
        schedule.push({
          day: day.day,
          dayOrder: day.dayOrder,
          table: dayClasses,
        });
      }
    }

    return schedule;
  }

  uniqueCodes(slots) {
    const seen = {};
    const result = [];
    for (const slot of slots) {
      if (!seen[slot.code]) {
        seen[slot.code] = true;
        result.push(slot.code);
      }
    }
    return result;
  }

  uniqueNames(slots) {
    const seen = {};
    const result = [];
    for (const slot of slots) {
      if (!seen[slot.name]) {
        seen[slot.name] = true;
        result.push(slot.name);
      }
    }
    return result;
  }

  uniqueRooms(slots) {
    const seen = {};
    const result = [];
    for (const slot of slots) {
      if (!seen[slot.roomNo]) {
        seen[slot.roomNo] = true;
        result.push(slot.roomNo);
      }
    }
    return result;
  }
}

module.exports = {
  Timetable,
};
