import { z } from "zod";
import * as CompanyEmailValidator from 'company-email-validator';
import { Browser, Page } from "puppeteer";

// Database Schema and Types ----------------------------------------------

// DB Schemas ----------------------------------------------

export const clientSchema = z.object({
  company: z.string().trim().min(2, 'Company name must be at least 2 characters long').max(50, 'Company name must be at most 50 characters long'),
  // status: z.enum(["ACTIVE", "INACTIVE", "TRIAL"]).default("INACTIVE"),
});

export const clientSchemaDb = clientSchema.extend({
  id: z.string().cuid(),
})

export const userSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 1 characters long').max(30, 'Name must be at most 30 characters long'),
  email: z.string().trim().min(1, 'Email is required')
    .email('Invalid email address. ')
    .refine((email) => {
      return CompanyEmailValidator.isCompanyEmail(email);
    }, {
      message: "You must provide your email that you use for your Company account. "
    }),
  password: z.string().trim().min(8, 'Password must be at least 8 characters long. ')
    .max(20, 'Password must be at most 20 characters long. ')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter. ')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter. ')
    .regex(/[0-9]/, 'Password must contain at least one number. ')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character: @$!%*?& ')
  ,
  // role: z.enum(["USER", "ADMIN", "INACTIVE"]).default("ADMIN"),
});

export const userSchemaDb = userSchema.extend({
  id: z.string().cuid(),
  clientId: z.string().cuid(),
})

// make signupFormSchema which extends userSchema and clientSchema
export const signupFormSchema = userSchema.merge(clientSchema);

// make loginFormSchema which picks only email and password from userSchema
export const loginFormSchema = userSchema.pick({ "email": true, "password": true });

// make authRecoveryFormSchema which picks only email from userSchema
export const authRecoveryFormSchema = userSchema.pick({ "email": true });

// make passwordResetFormSchema which picks only password from userSchema
export const passwordResetFormSchema = userSchema.pick({ "password": true });


// DB Types --------------------------------------------------------------

export type TClient = z.infer<typeof clientSchema> & { hostname: string, status: string };
export type TUser = z.infer<typeof userSchema> & { role: string, clientId: string };
export type TSignupForm = z.infer<typeof signupFormSchema>;
export type TLoginForm = z.infer<typeof loginFormSchema>;
export type TAuth = Omit<TUser, "password"> & TClient;
export type TAuthSession = TAuth | null;


// Email / nodemailer types -------------------------------------------------

export type EmailData = {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailResponse = {
  message: string;
}


// Crawler and Scrp Indexing Types -----------------------------------------------------

export type TCrawler = {
  success: boolean;
  message: string;
}

export type TScrpConfig = {
  browser: Browser;
  page: Page;
}

export type TScrpPageData = {
  url: string;
  title: string;
  description?: string;
  image?: string;
  content: string;
  links: string[];
  proxy?: string;
}

export type TScrpPageResponse = TScrpConfig & TScrpPageData;

export type TCrawlResults = {
  url: string;
  depth: number;
  success: boolean;
  links: string[];
}

export type TCrawlQueue = {
  url: string;
  depth: number;
}


// Proxy Types -----------------------------------------------------

export type ProxyConfig = {
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
  proxy_address: string;
  port: number;
  username?: string;
  password?: string;
  valid?: boolean;
  geolocation?: string;
}

export type ProxyData = {
  origin?: string;
  ip?: string;
  query?: string;
  status?: string;
}