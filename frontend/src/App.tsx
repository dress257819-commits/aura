import { Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ProfilePage from "@/pages/ProfilePage";
import Explore from "@/pages/Explore";
import Leaderboard from "@/pages/Leaderboard";
import Pricing from "@/pages/Pricing";
import DashboardHome from "@/pages/DashboardHome";
import DashboardLinks from "@/pages/DashboardLinks";
import DashboardShowcase from "@/pages/DashboardShowcase";
import DashboardMessages from "@/pages/DashboardMessages";
import StoryStudio from "@/pages/StoryStudio";
import DashboardCustomize from "@/pages/DashboardCustomize";
import DashboardAnalytics from "@/pages/DashboardAnalytics";
import NotFound from "@/pages/NotFound";
import { CursorTrail } from "@/components/shared/CursorTrail";
import { GalleryImageViewer } from "@/components/profile/ProfileCanvas";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <CursorTrail />
      <GalleryImageViewer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/dashboard/links" element={<DashboardLinks />} />
        <Route path="/dashboard/showcase" element={<DashboardShowcase />} />
        <Route path="/dashboard/messages" element={<DashboardMessages />} />
        <Route path="/dashboard/story-studio" element={<StoryStudio />} />
        <Route path="/dashboard/customize" element={<DashboardCustomize />} />
        <Route path="/dashboard/analytics" element={<DashboardAnalytics />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
