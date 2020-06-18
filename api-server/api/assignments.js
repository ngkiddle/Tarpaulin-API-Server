/*
 * API sub-router for assignment collection endpoints.
 */

const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

const { requireAuthentication } = require('../lib/auth');
const { validateAgainstSchema } = require('../lib/validation');
const {
  SubmissionSchema,
  saveSubmissionFile,
  getSubmissionsPageByAssignmentId
} = require('../models/submission');
const {
  AssignmentSchema,
  insertNewAssignment,
  getAssignmentById,
  deleteAssignmentById,
  updateAssignmentById
} = require('../models/assignment');
const {
  getCourseById,
  checkForEnrollment
} = require('../models/course');


const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

const upload = multer({
  // dest: `${__dirname}/uploads`
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: (req, file, callback) => {
      console.log(file);
      const origNameParts = file.originalname.split(".");
      const filename = crypto.pseudoRandomBytes(16).toString('hex');
      const extension = origNameParts[origNameParts.length - 1];
      callback(null, `${filename}.${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    callback(null, true);
  }
});


function removeUploadedFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


/*
 * Route to create a new submission.
 */
router.post('/:id/submissions', requireAuthentication, upload.single('file'), async (req, res, next) => {
  console.log("== req.file:", req.file);
    console.log("== req.body:", req.body);
    if (req.file) {
      try {
        const existingAssignment = await getAssignmentById(req.params.id);
        if (!existingAssignment){
          next();
        }
        if (
              req.role = "student" && 
              await checkForEnrollment(req.user, existingAssignment.courseId)
            ) { // Check if student enroled in course
          let submission = {
            contentType: req.file.mimetype,
            filename: req.file.filename,
            path: req.file.path,
            assignmentId: req.params.id,
            studentId: req.user
          };

          const id = await saveSubmissionFile(submission);
          //await removeUploadedFile(req.file);
          //const channel = getChannel();
          //channel.sendToQueue('images', Buffer.from(id.toString()));
          res.status(200).send({
            id: id
          });
        
      } else {
        res.status(403).send({
          error: "Unauthorized to post resource"
        });
      }
    } catch (err) {
      next(err);
    }
  } else {
    res.status(400).send({
      error: "Request must contain a submission file and valid request body."
    });
  }
});

router.get('/:id/submissions', requireAuthentication, async (req, res, next) => {
  try {
    const existingAssignment = await getAssignmentById(req.params.id);
    if (existingAssignment) {
      const assignmentCourse = await getCourseById(existingAssignment.courseId);
      if (req.user != assignmentCourse.instructorId && !(req.role === "admin")) {
        res.status(403).send({
          error: "Unauthorized to get resource"
        });
      } else {
        const submissionsPage = await getSubmissionsPageByAssignmentId(
          req.params.id, 
          (parseInt(req.query.page) || 1)
        );
        console.log("== Submissions page:")
        console.log(submissionsPage);
        submissionsPage.links = {};
        if (submissionsPage.page < submissionsPage.totalPages) {
          submissionsPage.links.nextPage = `/submission?page=${submissionsPage.page + 1}`;
          submissionsPage.links.lastPage = `/submission?page=${submissionsPage.totalPages}`;
        }
        if (submissionsPage.page > 1) {
          submissionsPage.links.prevPage = `/submission?page=${submissionsPage.page - 1}`;
          submissionsPage.links.firstPage = '/submission?page=1';
        }
        res.status(200).send(submissionsPage);
      }
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to get submissions.  Please try again later."
    });
  }
});


router.post('/', requireAuthentication, async (req, res, next) => {
  if (validateAgainstSchema(req.body, AssignmentSchema)) {
    try {
      const assignmentCourse = await getCourseById(req.body.courseId);
      console.log("== Instructor id vs user id:");
      console.log(assignmentCourse.instructorId, req.user);
      if (req.user != assignmentCourse.instructorId && !(req.role === "admin")) {
        res.status(403).send({
          error: "Unauthorized to create resource"
        });
      } else {
        const newId = await insertNewAssignment(req.body);
        if (newId) {
          res.status(201).send({
            id: newId,
            links: {
              assignment: `/assignments/${newId}`
            }
          });
        } else {
          next();
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).send({
        error: "Unable to create assignment.  Please try again later."
      });
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid assignment object."
    });
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const assignment = await getAssignmentById(req.params.id);
    if (assignment) {
      res.status(200).send(assignment);
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch assignment.  Please try again later."
    });
  }
});

router.delete('/:id', requireAuthentication, async (req, res, next) => {
  try {
    const existingAssignment = await getAssignmentById(req.params.id);
    if (existingAssignment) {
      const assignmentCourse = await getCourseById(existingAssignment.courseId);
      if (req.user != assignmentCourse.instructorId && !(req.role === "admin")) {
        res.status(403).send({
          error: "Unauthorized to modify resource"
        });
      } else {
        const deleteSuccessful = await deleteAssignmentById(req.params.id);
        if (deleteSuccessful) {
          res.status(204).send();
        } else {
          next();
        }
      }
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to delete assignment.  Please try again later."
    });
  }
});

router.patch('/:id', requireAuthentication, async (req, res, next) => {
  try {
    const existingAssignment = await getAssignmentById(req.params.id);
    const assignmentCourse = await getCourseById(existingAssignment.courseId);
    if (existingAssignment) {
      if (req.user != assignmentCourse.instructorId && !(req.role === "admin")) {
        res.status(403).send({
          error: "Unauthorized to modify resource"
        });
      } else {
        /*
          * Make sure the updated assignment has the same courseID as the existing assignment.  
          * If it doesn't, respond with a 403 error.  If the
          * photo doesn't already exist, respond with a 404 error.
          */
        const id = req.params.id;
        if (!(req.body.courseId) || req.body.courseId === existingAssignment.courseId) {
          const updateSuccessful = await updateAssignmentById(id, req.body);
          if (updateSuccessful) {
            res.status(200).send({
              links: {
                course: `/courses/${existingAssignment.courseId}`
              }
            });
          } else {
            next();
          }
        } else {
          res.status(403).send({
            error: "Updated assignment must have the same course ID"
          });
        }
      }
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to update assignment.  Please try again later."
    });
  }
});


router.use('*', (err, req, res, next) => {
  console.error(err);
  res.status(500).send({
    error: "An error occurred.  Try again later."
  });
});

module.exports = router;
