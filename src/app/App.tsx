import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App({ i18nLanguage: _i18nLanguage }: { i18nLanguage?: "en" | "th" }) {
  return <RouterProvider router={router} />;
}
