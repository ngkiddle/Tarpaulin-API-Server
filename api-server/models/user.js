/*
 * User schema and data accessor methods.
 */
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

/*
 * Schema describing required/optional fields of a review object.
 */
const UserSchema = {
  name: { required: true },
  email: { required: true },
  password: { required: true },
  role: { required: true },
};
exports.UserSchema = UserSchema;

/*
 * Insert a new User into the DB.
 */
exports.insertNewUser = async function (user) {
  const userToInsert = extractValidFields(user, UserSchema);
  console.log("  -- userToInsert:", userToInsert);
  userToInsert.password = await bcrypt.hash(
    userToInsert.password,
    8 // Length of hash
  );
  console.log("  -- userToInsert after hash:", userToInsert);

  const db = getDBReference();
  const collection = db.collection('users');
  const result = await collection.insertOne(userToInsert);

  return result.insertedId;
};


/*
 * Fetch a user from the DB based on user ID.
 */
exports.getUserById = async function (id, includePassword) {
  const db = getDBReference();
  const collection = db.collection('users');
  if (!ObjectId.isValid(id)) {
      return null;
  } else {
      const results = await collection
      .find({ _id: new ObjectId(id) })
      .toArray();

      result = results[0];
      // If a user was found, and includePassword is false, delete the passoword field
      if (result && !includePassword) {
        delete result.password;
      }

      return result;
  }
};

exports.getUserByEmail = async function (email, includePassword) {
  const db = getDBReference();
  const collection = db.collection('users');
  
  console.log(email)
  const results = await collection
  .find({ "email": email })
  .toArray();

  console.log(results);
  result = results[0];

  // If a user was found, and includePassword is false, delete the passoword field
  if (result && !includePassword) {
    delete result.password;
  }

  return result;
};

exports.validateUser = async function(email, password) {
  const user = await exports.getUserByEmail(email, true);
  if (user && await bcrypt.compare(password, user.password)){
    return { valid: true, role: user.role, id: user._id }
  } else {
    return { valid: false }
  }
};


  