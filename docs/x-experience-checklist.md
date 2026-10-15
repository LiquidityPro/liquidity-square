# X experience checklist

Tick a box when you have walked through that behavior in the app. The status column is the current build, not your pass.

- **Live** — saved on the account (API and database).
- **Sample** — on this device only (`localStorage`). Nothing is billed.
- **Missing** — not in the app yet.

Square-only pieces (stance, NGX tape, naira quotes) are at the bottom. They are not part of X.

## Shell

- [ ] Left nav: Home, Explore, Notifications, Messages, Pro rooms, Bookmarks, Profile — **Live**
- [ ] Unread badge on Notifications — **Live**
- [ ] Unread badge on Messages — **Sample**
- [ ] More menu: Lists, Communities, Settings — **Live** (Lists and Communities are samples)
- [ ] Post button opens the composer — **Live**
- [ ] Mobile bottom bar: Home, Explore, Notifications, Bookmarks, Profile — **Live**
- [ ] Mobile More menu for the rest — **Live**
- [ ] Right rail search — **Live**
- [ ] Right rail trending tickers — **Live**
- [ ] Right rail Top Movers (gainers and losers) — **Live**
- [ ] Right rail Who to follow, with Show more — **Live**
- [ ] Privacy and Terms links — **Live**
- [ ] Light and dark theme, remembered on this device — **Live**
- [ ] Sign in, and sign out — **Live**
- [ ] Install-app prompt — **Live**



## Home

- [ ] Following-style home feed — **Live**
- [ ] For You / algorithmic tab — **Missing**
- [ ] Inline composer at the top of Home — **Live**
- [ ] New posts arrive while you are on the floor — **Live**
- [ ] Infinite scroll — **Live**
- [ ] Empty, loading, and error states — **Live**
- [ ] Click a post to open the thread — **Live**
- [ ] Click a name or avatar to open that profile — **Live**
- [ ] Click a `$TICKER` to open the ticker room — **Live**



## A post

- [ ] Reply, with a count — **Live**
- [ ] Repost, with a count — **Live**
- [ ] Like, with a count — **Live**
- [ ] Bookmark — **Live**
- [ ] Share copies the post link — **Live**
- [ ] Quote post — **Missing**
- [ ] View count — **Missing**
- [ ] Relative time, full time on hover — **Live**
- [ ] "Replying to" on a reply — **Live**
- [ ] Thread line between a post and its replies — **Live**
- [ ] Bull / bear stance tag — **Live** (Square)
- [ ] Poll display — **Live**
- [ ] Create a poll — **Missing**
- [ ] Photo, video, or GIF on a post — **Missing**
- [ ] Link preview card — **Missing**
- [ ] `...` menu: delete your own post — **Live**
- [ ] `...` menu: follow or unfollow the author — **Live**
- [ ] `...` menu: mute, block, or report — **Missing**
- [ ] Pin a post to your profile — **Missing**
- [ ] Edit a post after sending — **Missing**
- [ ] Pro room card on a post opens the sample room — **Sample**



## Composer

- [ ] Write a post and send it — **Live**
- [ ] Character count, with a limit — **Live**
- [ ] Bull and bear stance — **Live** (Square)
- [ ] `$` suggests listed tickers, with price and change — **Live** (Square)
- [ ] Reply composer on a thread — **Live**
- [ ] Photo, GIF, or video attach — **Missing**
- [ ] Poll attach — **Missing** (button is present, disabled)
- [ ] Emoji picker — **Missing**
- [ ] Schedule a post — **Missing**
- [ ] Drafts — **Missing**
- [ ] Write a thread (several posts in one send) — **Missing**
- [ ] Who can reply — **Missing**
- [ ] Longer posts for a paid tier — **Missing**



## Post page

- [ ] Parent post shown above the reply — **Live**
- [ ] Replies listed under the post — **Live**
- [ ] Reply from the thread page — **Live**
- [ ] Back returns to the previous screen — **Live**



## Explore and search

- [ ] Explore landing: trending tickers and suggested people — **Live**
- [ ] Search box, results update as you type — **Live**
- [ ] Tabs: Top, People, Tickers — **Live**
- [ ] Latest posts tab — **Missing**
- [ ] Media tab — **Missing**
- [ ] Open a person from results — **Live**
- [ ] Open a ticker from results — **Live**
- [ ] News / topics module — **Missing**



## Notifications

- [ ] All tab — **Live**
- [ ] Mentions tab (replies) — **Live**
- [ ] Someone liked your post — **Live**
- [ ] Someone followed you — **Live**
- [ ] Someone replied to your post — **Live**
- [ ] Someone reposted your post — **Live**
- [ ] Quote and mention types, separate from replies — **Missing**
- [ ] Opening Notifications marks them read — **Live**
- [ ] Badge clears after you open them — **Live**
- [ ] Tap a notification to open the post or profile — **Live**
- [ ] Verified-only tab — **Missing**
- [ ] Per-type notification settings — **Missing**
- [ ] Browser push, after you allow it — **Live**



## Messages

- [x] Inbox list, newest activity first — **Sample**
- [x] Unread state on a thread — **Sample**
- [x] Open a thread — **Sample**
- [x] Send a message — **Sample**
- [x] Sending marks the thread read — **Sample**
- [ ] Message requests — **Missing**
- [ ] Group chats — **Missing**
- [ ] Photos in a chat — **Missing**
- [ ] Read receipts — **Missing**
- [ ] Search inside messages — **Missing**
- [ ] New message to any user — **Missing** (threads are the sample set)



## Bookmarks

- [ ] Bookmarks page lists saved posts — **Live**
- [ ] Remove a bookmark from the post — **Live**
- [ ] Bookmark folders — **Missing**



## Lists

- [ ] Lists index — **Sample**
- [ ] Open a list and see its members — **Sample**
- [ ] Follow or unfollow a list on this device — **Sample**
- [ ] A list timeline of those members' posts — **Missing**
- [ ] Create a list, add or remove members — **Missing**
- [ ] Pin a list — **Missing**



## Communities

- [ ] Communities index — **Sample**
- [ ] Open a community: rules, members, about — **Sample**
- [ ] Join or leave on this device — **Sample**
- [ ] Post inside a community — **Missing**
- [ ] Moderator tools — **Missing**



## Profile

- [ ] Banner, photo, name, handle — **Live**
- [ ] Bio, location, website, joined date — **Live**
- [ ] Website opens in a new tab — **Live**
- [ ] Follower and following counts — **Live**
- [ ] Followers list — **Live**
- [ ] Following list — **Live**
- [ ] Tabs: Posts, Replies, Media, Likes — **Live** (Media has no posts yet; there is no media model)
- [ ] Posts tab is top-level posts only — **Live**
- [ ] Replies tab is replies only — **Live**
- [ ] Likes tab is posts that account liked — **Live**
- [ ] Edit profile on your own account — **Live**
- [ ] Edit name (50), bio (160), location (30), website (100) — **Live**
- [ ] Edit photo (JPEG, PNG, or WebP, resized on device) — **Live**
- [ ] Edit banner (ember, lagoon, ink, forest, dusk) — **Live**
- [ ] Handle stays read-only (email local-part) — **Live**
- [ ] Save updates the profile and the session name and photo — **Live**
- [ ] Settings → Edit profile opens the dialog — **Live**
- [ ] Follow or unfollow someone else's profile — **Live**
- [ ] Verified mark on accounts that have it — **Live**
- [ ] "Follows you" — **Missing**
- [ ] Highlights tab — **Missing**
- [ ] Articles tab — **Missing**
- [ ] Pinned post — **Missing**
- [ ] Share profile — **Missing**
- [ ] Mute or block from the profile — **Missing**



## Pro rooms (X Spaces / Premium)

- [ ] Rooms index, with the featured sample marked — **Sample**
- [ ] Featured room (Banking Sector recap) is readable without joining — **Sample**
- [ ] Other rooms are blurred until Open preview — **Sample**
- [ ] Open preview stays unlocked on this device — **Sample**
- [ ] Host, tickers, listener count, and notes — **Sample**
- [ ] Add a note; it stays on this device — **Sample**
- [ ] Nothing is billed — **Sample**
- [ ] Live audio, speakers, and listeners — **Missing**
- [ ] Schedule a room, or play a replay — **Missing**
- [ ] Paid subscription that unlocks rooms — **Missing**



## Settings and account

- [ ] Settings page, with your handle — **Live**
- [ ] Appearance toggle — **Live**
- [ ] Shortcuts to Messages, Pro rooms, Lists, Communities, Bookmarks — **Live**
- [ ] Change email or password — **Missing**
- [ ] Privacy and safety controls — **Missing**
- [ ] Muted and blocked accounts — **Missing**
- [ ] Display: theme is there; font size and reduced motion are not — **Missing**
- [ ] Deactivate or delete the account — **Missing**



## Ticker room (Square, not X)

- [ ] Ticker page for a symbol — **Live**
- [ ] Session quote, change, and sector — **Live**
- [ ] Posts that mention that ticker — **Live**
- [ ] Company fundamentals card — **Live**
- [ ] Tape across the top of The Square — **Live**



## Still outside this pass

These are part of the current X product and are not built here:

- [ ] Grok
- [ ] Premium checkmark you can buy
- [ ] Creator subscriptions
- [ ] Ads and promoted posts
- [ ] Post analytics
- [ ] Articles and long-form
- [ ] Communities notes
- [ ] Undo send
- [ ] Alt text on images