
🎓 PROJECT: PeerConnect DIT (Improved Version)

🧠 Core Concept

PeerConnect DIT is a university-focused, community-driven platform where students can ask questions publicly and receive structured, categorized help from peers.

Unlike private messaging apps (e.g., WhatsApp, Discord), the platform ensures that:

* All interactions are public and searchable
* Knowledge becomes reusable
* Students can discover answers without asking again

The system is designed especially for international students in Germany, who often face barriers in accessing help.

⸻

🎯 Problem Statement

Students—especially international ones—face challenges such as:

* Not knowing who to ask for help
* Feeling uncomfortable contacting strangers privately
* Information being scattered across multiple platforms
* Repeated questions with no centralized answers

⸻

💡 Solution Overview

A structured post-and-reply platform with:

* Categorized posts
* Public replies
* Verified student-only access
* Reputation system for quality control
* Notification-based engagement (not algorithmic feed)

⸻

🧩 CORE FEATURES (DETAILED)

1. 📝 Post & Reply System (Main Feature)

Create Post

Users can create a post with:

* Text content (“What’s on your mind?”)
* Category selection:
    * Academic
    * Social
    * Sport
    * Daily Life Support
* Optional:
    * Location tag (e.g., within 2km, campus-based)
    * Urgency tag

Feed Display

* Posts are shown in a chronological feed
* Each post displays:
    * User name
    * Category tag
    * Time posted
    * Distance (if enabled)
    * Reply count

Reply System

* Users can reply publicly to posts
* Replies are:
    * Threaded under the post
    * Sortable (e.g., most helpful first)

Post Owner Actions

* Mark one reply as:
    * ✅ “Solution”
* Upvote helpful replies

⸻

2. 🔔 Notification System (Category-Based)

Instead of a complex algorithm:

Users choose notification preferences:

* Academic
* Social
* Sport
* Daily Life Support

System behavior:

* When a new post is created:
    * Only users subscribed to that category are notified

Notification types:

* New post in selected category
* Someone replied to your post
* Your reply was upvoted
* Your reply was marked as solution

⸻

3. 🎓 Student Verification System

Goal:

Restrict access to real university students in Germany

Process Flow:

1. User signs up with email
2. System checks email domain:
    * Example: @uni-dortmund.de
3. If valid:
    * Send verification email
4. User clicks confirmation link
5. Account becomes verified

Database Fields:

* email
* is_verified (boolean)
* university_domain
* verification_token

Optional Enhancement:

* Manual admin approval fallback

⸻

4. 👤 User Profile System

Basic Info:

* First Name
* Last Name
* Email (locked)
* Study Program
* Semester

Additional Info:

* Languages spoken

Preferences:

* Notification toggles per category

Public Profile View:

* Badge display
* Number of replies
* Number of accepted solutions

⸻

5. 🏆 Reputation & Badge System

Purpose:

Encourage:

* Participation
* High-quality answers

⸻

Badge Categories

🟢 Engagement-Based

* First Reply → 1 reply
* Getting Started → 3 replies

🔵 Contribution-Based

* Active Helper → 10+ replies
* Community Builder → 10+ (Social/Sport)

🟣 Quality-Based (Most Important)

* Helpful Contributor → 5 upvoted replies
* Trusted Helper → 15 upvoted replies
* Solution Provider → 5 accepted answers

⸻

System Logic

Each reply can:

* Receive upvotes
* Be marked as solution

Backend tracks:

* reply_count
* upvote_count
* solutions_count

⸻

6. 💳 Subscription System (Free vs Premium)

Database Fields:

* subscription_status (free / premium)
* start_date
* end_date

⸻

Free Users:

* Full access to posting & replying
* Limited visibility in feed (optional)
* Ads displayed

⸻

Premium Users:

* ⭐ Profile badge (visual highlight)
* 🚫 No ads
* 📈 Priority visibility (their posts appear higher)
* 🔔 Faster notification delivery (optional enhancement)

⸻

7. 🔍 Filtering & Search System

From your prototype (right panel):

Filters include:

* Distance:
    * Within 2 km
    * Within 10 km
* Time:
    * Last 24h
    * Last 3 days
    * Last 7 days
* Category:
    * Academic
    * Social
    * Support

Purpose:

* Reduce noise
* Help users find relevant posts quickly

⸻

8. 📍 Location-Based Feature (Optional but Strong)

* Users can enable location
* Posts show approximate distance (e.g., “0.5 km away”)
* Useful for:
    * Meeting in person
    * Local help (housing, shops, etc.)

⸻

9. 🧵 Threaded Discussion View

From your prototype:

* Clicking a post opens:
    * Full discussion thread
    * All replies
    * Reply input field

⸻
