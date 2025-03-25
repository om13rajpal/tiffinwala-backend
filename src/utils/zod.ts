import zod from "zod";
import { SignupRequest } from "../handlers/user/auth";
import { OtpDocument } from "../models/otp";

const SignupSchema = zod.object({
  firstName: zod
    .string()
    .min(2, {
      message: "First name must be at least 2 characters long",
    })
    .nonempty({
      message: "First name cannot be empty",
    }),
  lastName: zod
    .string()
    .min(2, {
      message: "Last name must be at least 2 characters long",
    })
    .nonempty({
      message: "Last name cannot be empty",
    }),
  phoneNumber: zod
    .string()
    .min(10, {
      message: "Phone number must be 10 characters",
    })
    .max(13, {
      message: "Phone number cannot be 10 characters",
    }),
});

const OtpSchema = zod.object({
  phone: zod
    .string()
    .min(10, {
      message: "Phone number must be 10 characters",
    })
    .max(13, {
      message: "Phone number cannot be 10 characters",
    })
    .nonempty({
      message: "Phone number cannot be empty",
    }),
  otp: zod
    .string()
    .min(6, {
      message: "OTP must be 6 characters long",
    })
    .max(6, {
      message: "OTP cannot be more than 6 characters long",
    })
    .nonempty({
      message: "OTP cannot be empty",
    }),
});

export function validateSignup(data: SignupRequest) {
  const result = SignupSchema.safeParse(data);
  return result;
}

export function validateOtp(data: OtpDocument){
  const result = OtpSchema.safeParse(data)
  return result
}
