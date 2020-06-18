const router = require('express').Router();
const fs = require('fs');
const { requireAuthentication } = require('../lib/auth');
const ObjectsToCsv = require('objects-to-csv');
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { getUserById } = require('../models/user');
const {
  CourseSchema,
  getCoursesPage,
  insertNewCourse,
  getCourseDetailsById,
  updateCourseById,
  deleteCourseById,
  getCourseStudentsByCourseId,
  getCourseAssignmentsByCourseId,
  manageEnrollments,
  saveCSVFile,
  getCSVInfoById
} = require('../models/course');

/*
 * Route to return a paginated list of courses.
 */
router.get('/', async (req, res) => {
  try {
    const query = extractValidFields(req.query, CourseSchema);
    /*
     * Fetch page info, generate HATEOAS links for surrounding pages and then
     * send response.
     */
    const coursePage = await getCoursesPage(parseInt(req.query.page) || 1, query);
    coursePage.links = {};
    if (coursePage.page < coursePage.totalPages) {
      coursePage.links.nextPage = `/courses?page=${coursePage.page + 1}`;
      coursePage.links.lastPage = `/courses?page=${coursePage.totalPages}`;
    }
    if (coursePage.page > 1) {
      coursePage.links.prevPage = `/courses?page=${coursePage.page - 1}`;
      coursePage.links.firstPage = '/courses?page=1';
    }
    res.status(200).send(coursePage);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Error fetching courses list.  Please try again later."
    });
  }
});
/*
 * Route to create a new course.
 */
router.post('/', requireAuthentication, async (req, res) => {
  if(req.role === "admin"){
    if (validateAgainstSchema(req.body, CourseSchema)) {
      try {
        req.body.students = [];
        req.body.assignments = [];
        const id = await insertNewCourse(req.body);
        res.status(201).send({
          id: id,
          links: {
            courses: `/courses/${id}`
          }
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({
          error: "Error inserting course into DB.  Please try again later."
        });
      }
    } else {
      res.status(400).send({
        error: "Request body is not a valid course object."
      });
    }
  }
  else{
    res.response(403).send({
      error: "User is not authenticated to create a course."
    })
  }
});


/*
 * Route to fetch info about a specific course.
 */
router.get('/:id', requireAuthentication, async (req, res, next) => {
  try {
    if(req.role === "admin"){
      const course = await getCourseDetailsById(req.params.id);
      if (course) {
        res.status(200).send(course);
      } else {
        next();
      }
    }
    else{
        res.response(403).send({
          error: "User is not authenticated to create a course."
        })
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch course.  Please try again later."
    });
  }
});
/*
 * Route to replace data for a course.
 */
router.patch('/:id', requireAuthentication, async (req, res, next) => {
  const courseById = await getCourseDetailsById(req.params.id); 
  if (req.role === "admin" || (req.role === "instructor" && (req.user === courseById.instructorId))){
    const course = extractValidFields(req.body, CourseSchema);
    if (course) {
      try {
        const id = req.params.id
        const updateSuccessful = await updateCourseById(id, course);
        if (updateSuccessful) {
          res.status(200).send();
        } else {
          next();
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({
          error: "Unable to update specified course.  Please try again later."
        });
      }
    } else {
      res.status(400).send({
        error: "Request body is not a valid course object"
      });
    }
  }
  else{
    res.status(403).send({
      error: "Unauthorized to access the specified resource"
    });
  }
});
/*
 * Route to delete a course.
 */
router.delete('/:id', requireAuthentication, async (req, res, next) => {
  try {
    if (req.role !== "admin"){
      res.status(403).send({
        error: "Unauthorized to access the specified resource"
      });
    }
    else{
      const deleteSuccessful = await deleteCourseById(req.params.id);
      if (deleteSuccessful) {
        res.status(204).end();
      } else {
        next();
      }
    } 
  }
  catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to delete course.  Please try again later."
    });
  }
});

/*
 * Route to create a new student enrollment course.
 */
router.post('/:id/students', requireAuthentication, async (req, res) => {
  const course = await getCourseDetailsById(req.params.id); 
  if (req.role === "admin" || (req.role === "instructor" && (req.user === course.instructorId))){
    if (req.body && req.body.add && req.params.id && req.body.remove) {
      try {
        const newEnrollment = []
        const rmEnrollment = []
        for(var stud in req.body.add){
          const student = await getUserById(req.body.add[stud], false);
          if(student.role === "student"){
            newEnrollment.push({
              studentId: req.body.add[stud],
              courseId: req.params.id
            });
          }
          
        }
        for(var stud in req.body.remove){
          const student = await getUserById(req.body.remove[stud], false);
          if(student.role === "student"){
            rmEnrollment.push({
              studentId: req.body.remove[stud],
              courseId: req.params.id
            });
          }
        }
        const id = await manageEnrollments(newEnrollment, rmEnrollment);
        if (id){
          res.status(200).send({ ids: id });
        }
        else{
          res.status(400).send({
            error: "Entries to add are already added or entries to remove do not exist."
          });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({
          error: "Error inserting enrollment into DB.  Please try again later."
        });
      }
    } else {
      res.status(400).send({
        error: "Request body is not a valid course object."
      });
    }
  }
  else{
    res.response(403).send({
      error: "User is not authenticated to create a course."
    })
  }
});
/*
 * Route to fetch info about a specific course.
 */
router.get('/:id/students', requireAuthentication, async (req, res, next) => {
  try {
    const course = await getCourseDetailsById(req.params.id); 
    if (req.role === "admin" || (req.role === "instructor" && (req.user === course.instructorId))){
      const students = await getCourseStudentsByCourseId(req.params.id);
      if (students) {
        res.status(200).send(students);
      } else {
        next();
      }
    }
    else{
        res.response(403).send({
          error: "User is not authenticated to access a course's student list."
        })
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch course student lists.  Please try again later."
    });
  }
});



/*
 * Route to fetch info about a specific course.
 */
router.get('/:id/roster', requireAuthentication, async (req, res, next) => {
  try {
    const course = await getCourseDetailsById(req.params.id); 
    if (req.role === "admin" || (req.role === "instructor" && (req.user === course.instructorId))){
      const students = await getCourseStudentsByCourseId(req.params.id);
      const studentDetails = []
      if (students) {
        for (var student in students){
          studentDetails.push(await getUserById(students[student], false));
        }
        fs.open("/" + req.params.id + ".csv", 'w' , function (){});
        const csv = new ObjectsToCsv(studentDetails);
        await csv.toDisk("/" + req.params.id + ".csv")
        const roster = {
          filename: req.params.id + ".csv",
          path: "/" + req.params.id + ".csv",
          courseDetails: course
        };
        const csvId = await saveCSVFile(roster);
        const rosterInfo = await getCSVInfoById(csvId);
        const returnObj = {
          link: `/media/roster/${rosterInfo.filename}`
        }
        res.status(200).send(returnObj);
      } else {
        next();
      }
    }
    else{
        res.response(403).send({
          error: "User is not authenticated to access a course's student list."
        })
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch course student lists.  Please try again later."
    });
  }
});

/*
 * Route to fetch info about a specific course.
 */
router.get('/:id/assignments', requireAuthentication, async (req, res, next) => {
  try {
    const course = await getCourseDetailsById(req.params.id); 
    if (req.role === "admin" || (req.role === "instructor" && (req.user === course.instructorId))){
      const assignments = await getCourseAssignmentsByCourseId(req.params.id);
      if (assignments) {
        res.status(200).send(assignments);
      } else {
        next();
      }
    }
    else{
        res.response(403).send({
          error: "User is not authenticated to access a course's assignment list."
        })
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch course assignments.  Please try again later."
    });
  }
});

module.exports = router;
