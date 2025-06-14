import jwt from "jsonwebtoken";
import db from "../config/db.config.js";
import { userService } from "../services/user.service.js";
import { userValidation } from "../validators/user.validation.js";

export const signIn = async (req, res) => {
  const signOptions = {
    expiresIn: "7d",
    algorithm: "RS256",
  };
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Fill out the credentials" });
  }
  const searchQuery = `select case when count(*) > 0 then TRUE else FALSE end as is_valid from users where username=$1 and password=$2;`;

  try {
    const result = await db.query(searchQuery, [username, password]);
    var token = jwt.sign({ username }, process.env.PRIVATE_KEY, signOptions);

    if (result.rows[0].is_valid) {
      return res
        .status(200)
        .send({ token: token, message: "Sign in Successfull" });
    } else {
      return res.status(400).send({ message: "Sign in Failed" });
    }
  } catch (err) {
    return res.status(500).json({
      error: "Something is wrong with the /sign-in :\n " + err.stack || err,
    });
  }
};

export const signUp = async (req, res) => {
  try {
    const input = req.body;

    const validation = await userValidation(input);
    if (!validation.isValid) {
      return res.status(400).send(validation.errors);
    }

    const result = await userService.signUp(input);
    return res.status(result.status).send(result.body);
  } catch (err) {
    return res.status(500).json({
      error: "Something is wrong with the /sign-up :\n " + err.stack,
    });
  }
};
