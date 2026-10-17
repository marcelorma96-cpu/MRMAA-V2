import Home from "@/components/home-entry";
export const metadata = { title: "UnoMesa · Ingreso", robots: { index: false, follow: false } };
export default function LoginPage() { return <Home initialEntry="login" />; }
