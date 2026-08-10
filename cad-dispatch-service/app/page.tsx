import { redirect } from "next/navigation";

// Middleware sends unauthenticated users to /login; authenticated ones land on
// the console.
export default function Home() {
  redirect("/console");
}
