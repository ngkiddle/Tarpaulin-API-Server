const router = require('express').Router();

const { validateAgainstSchema } = require('../lib/validation');
const {
  UserSchema,
  insertNewUser,
  getUserById,
  getUserByEmail,
  validateUser
} = require('../models/user');
const {
  getEnrollmentsByStudent,
  getCoursesByInstructor
} = require('../models/course');
const { generateAuthToken, requireAuthentication } = require('../lib/auth');

createStudent = async (req, res, next) => {
  if (validateAgainstSchema(req.body, UserSchema)) {
    // Check if email already in use
    userByEmail = await getUserByEmail(req.body.email, false);
    console.log(userByEmail);
    if (userByEmail) {
      return res.status(400).send({
        error: "Email already in use"
      });
    }
    // If the user is attempting to create an admin user, they must provide authentication
    if (req.body.role === "instructor" || req.body.role === "admin"){
      next();
    } else {
      try {
        const id = await insertNewUser(req.body);
        res.status(201).send({
          _id: id
        });
      } catch (err) {
        console.error("  -- Error:", err);
        return res.status(500).send({
          error: "Error inserting new user.  Try again later."
        });
      }
    }
  } else {
    res.status(400).send({
      error: "Request body does not contain a valid User."
    });
  }
}

createNonStudent = async (req, res, next) => {
  if (req.role === "admin") {
    try {
      const id = await insertNewUser(req.body);
      res.status(201).send({
        _id: id
      });
    } catch (err) {
      console.error("  -- Error:", err);
      return res.status(500).send({
        error: "Error inserting new user.  Try again later."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to create user with specified role"
    });
  }
}

router.post('/', createStudent, requireAuthentication, createNonStudent);

router.get('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user != req.params.id && !(req.role === "admin")) {
    res.status(403).send({
      error: "Unauthorized to access the specified resource"
    });
  } else {
    try {
      const user = await getUserById(req.params.id);
      if (user) {
        if (user.role === "instructor"){
          const taughtCourses = await getCoursesByInstructor(user._id);
          let courseIds = [];
          console.log(taughtCourses);
          taughtCourses.forEach(course => {
            courseIds.push(course._id);
          });
          user.courses = courseIds;
        }
        if (user.role === "student"){
          const enrollments = await getEnrollmentsByStudent(user._id);
          let courseIds = [];
          enrollments.forEach(enrollment => {
            courseIds.push(enrollment.courseId);
          });
          user.courses = courseIds;
        }
        res.status(200).send(user);
      } else {
        next();
      }
    } catch (err) {
      console.error("  -- Error:", err);
      res.status(500).send({
        error: "Error fetching user.  Try again later."
      });
    }
  }
});

router.post('/login', async (req, res) => {
  // Thanks to Javascript, I was getting an erronious 400 error when id was 0
  if (req.body && req.body.email && req.body.password) {
    try {
      const authenticated = await validateUser(
        req.body.email,
        req.body.password
      );
      if (authenticated.valid) {
        console.log("id for loged in user", authenticated.id)
        const token = generateAuthToken(authenticated.id, authenticated.role);
        res.status(200).send({
          token: token
        });
      } else {
        res.status(401).send({
          error: "Invalid authentication credentials."
        })
      }
    } catch (err) {
      console.error("  -- error:", err);
      res.status(500).send({
        error: "Error logging in.  Try again later."
      });
    }
  } else {
    res.status(400).send({
      error: "Request body needs a user ID and password."
    });
  }
});


module.exports = router;
