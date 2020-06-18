const { getAssignmentCountByCourseId } = require('../models/assignment');
const { getUserById } = require('../models/user');
const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');
const { ObjectId, GridFSBucket } = require('mongodb');
const fs = require('fs');
/*
 * Schema describing required/optional fields of a course object.
 */
const CourseSchema = {
    subject: { required: true },
    number: { required: true },
    title: { required: true },
    term: { required: true },
    instructorId: { required: true},
    students: {require: false},
    assignments: {require: false}
   
  };
  exports.CourseSchema = CourseSchema;

/*
 * Executes a DB query to return a single page of courses.  Returns a
 * Promise that resolves to an array containing the fetched page of courses.
 */
async function getCoursesPage(page, query) {
    const db = getDBReference();
    const collection = db.collection('courses');
    const count = await collection.countDocuments();
  
    /*
     * Compute last page number and make sure page is within allowed bounds.
     * Compute offset into collection.
     */
    const pageSize = 10;
    const lastPage = Math.ceil(count / pageSize);
    page = page > lastPage ? lastPage : page;
    page = page < 1 ? 1 : page;
    const offset = (page - 1) * pageSize;
  
    const results = await collection.find(query)
      .sort({ _id: 1 })
      .skip(offset)
      .limit(pageSize)
      .toArray();
  
    return {
      courses: results,
      page: page,
      totalPages: lastPage,
      pageSize: pageSize,
      count: count
    };
  }
  exports.getCoursesPage = getCoursesPage;

  /*
 * Executes a DB query to fetch information about a single specified
 * course based on its ID.  Does not fetch photo data for the
 * course.  Returns a Promise that resolves to an object containing
 * information about the requested course.  If no course with the
 * specified ID exists, the returned Promise will resolve to null.
 */
async function getCourseById(id) {
  const db = getDBReference();
  const collection = db.collection('courses');
    if (!ObjectId.isValid(id)) {
      return null;
    }
    else {
      const results = await collection
        .find({ _id: new ObjectId(id) })
        .toArray();
      return results[0];
    }
  }
exports.getCourseById = getCourseById;

/*
 * Executes a DB query to insert a new course into the database.  Returns
 * a Promise that resolves to the ID of the newly-created course entry.
 */
async function insertNewCourse(course) {
  course = extractValidFields(course, CourseSchema);
  const db = getDBReference();
  const collection = db.collection('courses');
  const result = await collection.insertOne(course);
  return result.insertedId;
}
exports.insertNewCourse = insertNewCourse;


/*
  * Executes a DB query to fetch detailed information about a single
  * specified course based on its ID, including photo data for
  * the course.  Returns a Promise that resolves to an object containing
  * information about the requested course.  If no course with the
  * specified ID exists, the returned Promise will resolve to null.
  */
async function getCourseDetailsById(id) {
  /*
    * Execute three sequential queries to get all of the info about the
    * specified course, including its photos.
    */
  const course = await getCourseById(id);
  if (course) {
    console.log("Found a course!");
  }
  return course;
}
exports.getCourseDetailsById = getCourseDetailsById;


/*
 * Executes a DB query to replace a specified course with new data.
 * Returns a Promise that resolves to true if the course specified by
 * `id` existed and was successfully updated or to false otherwise.
 */
async function updateCourseById(id, course) {
  course = extractValidFields(course, CourseSchema);
  const db = getDBReference();
  const collection = db.collection('courses');
  console.log(id)
  const result = await collection.updateOne({ _id: new ObjectId(id) }, {$set: course});
  console.log(result.result)
  return result.result.nModified;
}
exports.updateCourseById = updateCourseById;

/*
 * Executes a DB query to delete a course specified by its ID.  Returns
 * a Promise that resolves to true if the course specified by `id` existed
 * and was successfully deleted or to false otherwise.
 */
async function deleteCourseById(id) {
  const db = getDBReference();
  const course_collection = db.collection('courses');
  const assignment_collection = db.collection('assignments');
  const result = await course_collection.deleteOne({ _id: new ObjectId(id) });
  if (await getAssignmentCountByCourseId(id)){
    const resultAsgn = await assignment_collection.deleteMany({courseId: id});
    if(result.result.n && resultAsgn.result.n){
      return result.result.n;
    }
  }
  if(result.result.n){
    return result.result.n;
  }
}
exports.deleteCourseById = deleteCourseById;

async function getCourseStudentsByCourseId(id){
  const db = getDBReference();
  const collection = db.collection('enrollments');
  const studentIds = []
  if (!ObjectId.isValid(id)) {
      return null;
  } else {
      const results = await collection
      .find({ courseId: id })
      .toArray();
      for (var stud in results){
        studentIds.push(results[stud].studentId)
      }
      return studentIds;
  }
}
exports.getCourseStudentsByCourseId = getCourseStudentsByCourseId;




async function getCourseAssignmentsByCourseId(id){
  if(await getAssignmentCountByCourseId(id)){
    const db = getDBReference();
    const collection = db.collection('assignments');
    const assignmentIds = []
    if (!ObjectId.isValid(id)) {
        return null;
    } else {
        const results = await collection
        .find({ courseId: id })
        .toArray();
        console.log(results)
        for (var assign in results){
          assignmentIds.push(results[assign]._id)
        }
        return assignmentIds;
    }
  }
  else{
    // there are no assignments for the course
    return []
  }
}
exports.getCourseAssignmentsByCourseId = getCourseAssignmentsByCourseId;


async function manageEnrollments(enroll, unenroll){
  const studentIdsAdded = [];
  const studentIdsRemoved = [];
  if(enroll.length){
    const enrolled = await getCourseStudentsByCourseId(enroll[0].courseId)
    for (var stud in enrolled){
      for (var id in enroll){
        if (enroll[id].studentId === enrolled[stud]){
          enroll.splice(id,1);
          continue;
        }
      }
    }
  }
  if(enroll.length){
    const db = getDBReference();
    const collection = db.collection('enrollments');
    const results = await collection.insertMany(enroll);
    for (var id in results.ops){
        studentIdsAdded.push(results.ops[id].studentId)
    }
  }
  if(unenroll.length){
    const db = getDBReference();
    const collection = db.collection('enrollments');
    for (var id in unenroll){
      const results = await collection.deleteMany({studentId: unenroll[id].studentId, courseId: unenroll[id].courseId});
      studentIdsRemoved.push(unenroll[id].studentId)
    }
  }
  if(studentIdsAdded.length || studentIdsRemoved.length){
    return {add: studentIdsAdded, remove: studentIdsRemoved};
  }
  else{
    return null;
  }
}
exports.manageEnrollments = manageEnrollments;

async function checkForEnrollment(studentId, courseId){
  const db = getDBReference();
  const collection = db.collection('enrollments');
  const enrollmentCount = await collection.count({studentId: studentId, courseId: courseId});
  console.log(`== Found ${enrollmentCount} enrollments`);
  return enrollmentCount > 0;
}
exports.checkForEnrollment = checkForEnrollment;

async function getEnrollmentsByStudent(studentId) {
  const db = getDBReference();
  const collection = db.collection('enrollments');
  console.log(`==student id: ${studentId}`);
  const studentEnrollments = await collection.find({studentId: `${studentId}`}).toArray();
  console.log(studentEnrollments);
  return studentEnrollments;
}
exports.getEnrollmentsByStudent = getEnrollmentsByStudent;

async function getCoursesByInstructor(instructorId) {
  const db = getDBReference();
  const collection = db.collection('courses');
  console.log(instructorId);
  const theCourses = await collection.find({instructorId: `${instructorId}`}).toArray();
  console.log(theCourses);

  return theCourses;
}
exports.getCoursesByInstructor = getCoursesByInstructor;

exports.saveCSVFile = async function (roster) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket = new GridFSBucket(db, {
      bucketName: 'roster'
    });
    let metadata = {
      contentType: "text/csv",
      courseDetails: roster.course
    };

    const uploadStream = bucket.openUploadStream(
      roster.filename,
      { metadata: metadata }
    );
    fs.createReadStream(roster.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
};

exports.getCSVInfoById = async function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'roster'
  });
  // const collection = db.collection('images');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    // const results = await collection.find({ _id: new ObjectId(id) })
    //   .toArray();
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
};

exports.getCSVDownloadStreamByFilename = function (filename) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'roster'
  });
  return bucket.openDownloadStreamByName(filename);
};