import { redirect } from "next/navigation";

// Root domain → public Open Bar signup page.
// Staff get to the admin panel at /admin (password-gated)
// or the door scanner at /door (also password-gated).
export default function Home() {
  redirect("/signup");
}
