import SignupVerified from "@/auth/components/SignUpVerified";
import { TAuth } from "@/lib/def";
import { decryptDataString } from "@/lib/hash";
import { createClient } from "@/supabase/server";

function SignUpVerificationFailed() {
  return <p>There was an signup verification error, please try again later.</p>;
}
function SignupVerificationLinkNotValid() {
  return <p>SignUp confirmation Link is not valid. Please try again</p>;
}

export default async function SignUpConfirmation(props: { searchParams: Promise<{ hash: string }> }) {
  const searchParams = await props.searchParams;
  if (!searchParams.hash) {
    return <SignupVerificationLinkNotValid />;
  }

  const hash = searchParams.hash;
  const secretKey = process.env.SECRET_KEY;
  const decryptedHash = decryptDataString(hash, secretKey);
  const [email] = decryptedHash.split(":");

  // Check if email id valid
  if (!email) {
    return <SignupVerificationLinkNotValid />;
  }

  // Check if the user with this email exist in database
  const supabaseClient = createClient();

  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select()
    // Filters
    .eq("email", email);

  if (usersError) {
    return <SignUpVerificationFailed />;
  }

  if (!users || users.length === 0) {
    return <p>User with this email does not exist</p>;
  } else {
    const userCreatedAt = users[0].created_at;

    // Check if user created_at time is less than 24 hours
    const diffTime = Math.abs(new Date().getTime() - new Date(userCreatedAt).getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

    if (diffHours > Number(process.env.VERIFICATION_LINK_VALIDITY_HOURS)) {
      return (
        <p>
          Your signup verification link has expired.
          <br /> Please contact our support team for assistance.
        </p>
      );
    }

    // Update client status to TRIAL
    const { error: clientUpdateError } = await supabaseClient
      .from("clients")
      .update({ status: "TRIAL" })
      .eq("id", users[0].client_id);

    if (clientUpdateError) {
      return <SignUpVerificationFailed />;
    }
  }

  // User signup verification successful, create auth session and login user
  // Get client data from database
  const { data: clients, error: clientsError } = await supabaseClient
    .from("clients")
    .select()
    // Filters
    .eq("id", users[0].client_id);

  if (clientsError) {
    return <SignUpVerificationFailed />;
  }

  if (!clients || clients.length === 0) {
    return <SignUpVerificationFailed />;
  }

  const { name, role, client_id: clientId } = users[0];
  const { name: company, hostname, status } = clients[0];

  const authPayload: TAuth = {
    name,
    email,
    role,
    clientId,
    company,
    hostname,
    status,
  };

  return <SignupVerified authPayload={authPayload} />;
}
