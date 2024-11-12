import DialogAuthResetPassword from "@/auth/components/DialogAuthResetPassword";
import { decryptDataString } from "@/lib/hash";
import { createClient } from "@/supabase/server";

async function PasswordResetLinkNotValid() {
  return <p>SignUp confirmation Link is not valid. Please try again</p>;
}

function PasswordResetFailed() {
  return <p>There was a password reset error, please try again later.</p>;
}

export default async function PasswordRecovery(props: { searchParams: Promise<{ hash?: string }> }) {
  const searchParams = await props.searchParams;
  const hash = searchParams.hash;

  if (!hash) {
    return <PasswordResetLinkNotValid />;
  }

  const secretKey = process.env.SECRET_KEY;
  const decryptedHash = decryptDataString(hash, secretKey);
  const [email] = decryptedHash.split(":");

  // Check if email is valid
  if (!email) {
    return <PasswordResetLinkNotValid />;
  }

  // Check if the user with this email exist in database
  const supabaseClient = createClient();

  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select()
    // Filters
    .eq("email", email);

  if (usersError) {
    console.log("usersError", usersError);
    return <PasswordResetFailed />;
  }

  if (!users || users.length === 0) {
    return <p>User with this email does not exist</p>;
  } else {
    // Displays the password recovery form modal
    return <DialogAuthResetPassword email={email} />;
  }
}
