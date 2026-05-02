import type { PostCategory } from "@peerconnect/shared";

const categories: PostCategory[] = [
  "Academic",
  "Social",
  "Sport",
  "Daily Life Support",
];

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>PeerConnect</h1>
      <p>University Q&amp;A Platform</p>
      <p>Categories: {categories.join(", ")}</p>
    </div>
  );
}
