import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, Search, Trophy, UserPlus, X } from 'lucide-react';
import {
  acceptChallengeInvite,
  acceptFriendRequest,
  cancelFriendRequest,
  declineChallengeInvite,
  fetchFriends,
  fetchFriendRequests,
  fetchInvites,
  fetchSharedChallenges,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendChallengeInvite,
  sendFriendRequest,
  type ChallengeInvite,
  type Friend,
  type FriendRequestItem,
  type PublicUser,
  type SharedChallenge,
} from '../lib/friendsApi';
import {
  fetchMyChallenges,
  type ChallengeParticipation,
} from '../lib/challengesApi';

/**
 * Friends page (preview #16, light). Single-column order:
 * search → pending requests → friends (per-friend challenge
 * progress + points, loaded on tap as before) → challenge
 * invitations → peach privacy callout.
 *
 * Privacy by design: the server only ever returns another user as
 * { id, name, initial }, and shared progress shows ONLY the fields
 * both friends are allowed to see — challenge name, current day /
 * total, completed days, progress and points earned. There is no way
 * from this page to see a friend's tasks, Salah records, study stats,
 * profile, or points history.
 */
export default function Friends({
  onNotify,
  refreshKey,
  guestMode,
}: {
  onNotify: (message: string) => void;
  refreshKey: number;
  guestMode: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [invitesIn, setInvitesIn] = useState<ChallengeInvite[]>([]);
  const [invitesOut, setInvitesOut] = useState<ChallengeInvite[]>([]);
  const [myChallenges, setMyChallenges] = useState<ChallengeParticipation[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [shared, setShared] = useState<SharedChallenge[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [inviteFor, setInviteFor] = useState<Friend | null>(null);
  const [inviteChallengeId, setInviteChallengeId] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState<ChallengeInvite | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [removingFriend, setRemovingFriend] = useState<Friend | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function refresh() {
    if (guestMode) return;
    try {
      const [friendsResult, requestsResult, invitesResult, mineResult] =
        await Promise.allSettled([
          fetchFriends(),
          fetchFriendRequests(),
          fetchInvites(),
          fetchMyChallenges(),
        ]);
      if (friendsResult.status === 'fulfilled') setFriends(friendsResult.value);
      if (requestsResult.status === 'fulfilled') {
        setIncoming(requestsResult.value.incoming);
        setOutgoing(requestsResult.value.outgoing);
      }
      if (invitesResult.status === 'fulfilled') {
        setInvitesIn(invitesResult.value.incoming);
        setInvitesOut(invitesResult.value.outgoing);
      }
      if (mineResult.status === 'fulfilled') setMyChallenges(mineResult.value.active);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Friends could not be loaded.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, guestMode]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await action();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      onNotify(message);
    } finally {
      setBusy('');
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) {
      onNotify('Search needs at least 2 characters.');
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery.trim()));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function openShared(friend: Friend) {
    setSelectedFriend(friend);
    setShared([]);
    setSharedLoading(true);
    try {
      const result = await fetchSharedChallenges(friend.id);
      setShared(result.shared);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Shared challenges could not be loaded.');
    } finally {
      setSharedLoading(false);
    }
  }

  if (guestMode) {
    return (
      <section className="sc-friends">
        <PageHeading
          eyebrow="COMMUNITY · FRIENDS"
          title="Study together, with consent."
          text="Add friends, share challenge progress, and invite people you trust — only ever with their explicit acceptance."
        />
        <div className="acard-l">
          <p className="mut">
            Friends need a signed-in account. Sign in to send friend requests and share
            challenge progress.
          </p>
        </div>
      </section>
    );
  }

  const friendIds = new Set(friends.map((f) => f.id));
  const pendingOutgoingIds = new Set(outgoing.map((r) => r.toUserId));

  return (
    <section className="sc-friends">
      <PageHeading
        eyebrow="COMMUNITY · FRIENDS"
        title="Study together, with consent."
        text="Add friends, share challenge progress, and invite people you trust — only ever with their explicit acceptance. Nobody is ever added automatically."
      />

      {error && <p className="form-error">{error}</p>}

      <div className="acard-l">
        <h5>Dost dhoondo</h5>
        <p className="mut">
          Search by name, or by the exact email address they signed up with. Search
          results show only a name — never an email or profile details.
        </p>
        <form className="friend-search" onSubmit={handleSearch}>
          <Search size={16} />
          <input
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Dost ka naam dhoondo…"
            aria-label="Search users"
          />
          <button className="primary-button" type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div>
            {searchResults.map((person) => {
              const isFriend = friendIds.has(person.id);
              const pending = pendingOutgoingIds.has(person.id);
              return (
                <div className="taskrow" key={person.id}>
                  <span className="snum2">{person.initial}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{isFriend ? 'Already your friend' : pending ? 'Request sent' : 'AHDORA user'}</small>
                  </div>
                  {!isFriend && !pending && (
                    <button
                      className="outline-button"
                      disabled={busy === `add-${person.id}`}
                      onClick={() =>
                        run(`add-${person.id}`, async () => {
                          await sendFriendRequest(person.id);
                          onNotify(`Friend request sent to ${person.name}.`);
                        })
                      }
                    >
                      <UserPlus size={15} /> Add friend
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
          <p className="mut">No users found for that search.</p>
        )}
      </div>

      <div className="acard-l">
        <h5>Friend request aayi hai ({incoming.length})</h5>
        {incoming.length === 0 && outgoing.length === 0 && (
          <p className="mut">No pending friend requests.</p>
        )}
        {incoming.map((request) => (
          <div className="taskrow" key={request.id}>
            <span className="snum2 av-peach">{request.other?.initial ?? '?'}</span>
            <div>
              <strong>{request.other?.name ?? 'Unknown user'}</strong>
              <small>Dost banna chahta hai</small>
            </div>
            <div className="friend-actions">
              <button
                className="primary-button"
                disabled={busy === `accept-${request.id}`}
                onClick={() =>
                  run(`accept-${request.id}`, async () => {
                    await acceptFriendRequest(request.id);
                    onNotify(`You are now friends with ${request.other?.name ?? 'them'}.`);
                  })
                }
              >
                <Check size={15} /> Accept
              </button>
              <button
                className="outline-button"
                disabled={busy === `reject-${request.id}`}
                onClick={() =>
                  run(`reject-${request.id}`, async () => {
                    await rejectFriendRequest(request.id);
                    onNotify('Friend request declined.');
                  })
                }
              >
                Decline
              </button>
            </div>
          </div>
        ))}
        {outgoing.map((request) => (
          <div className="taskrow" key={request.id}>
            <span className="snum2">{request.other?.initial ?? '?'}</span>
            <div>
              <strong>{request.other?.name ?? 'Unknown user'}</strong>
              <small>Request sent — waiting for them</small>
            </div>
            <button
              className="outline-button"
              disabled={busy === `cancel-${request.id}`}
              onClick={() =>
                run(`cancel-${request.id}`, async () => {
                  await cancelFriendRequest(request.id);
                  onNotify('Friend request cancelled.');
                })
              }
            >
              Cancel
            </button>
          </div>
        ))}
      </div>

      <div className="acard-l">
        <h5>Mere dost ({friends.length})</h5>
        {friends.length === 0 && (
          <p className="mut">
            No friends yet. Send a request above — they join only when they accept it.
          </p>
        )}
        {friends.map((friend) => (
          <div className="taskrow" key={friend.id}>
            <span className="snum2">{friend.initial}</span>
            <div>
              <strong>{friend.name}</strong>
              <small>
                Friends since{' '}
                {new Date(friend.since).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </small>
            </div>
            <div className="friend-actions">
              <button className="outline-button" onClick={() => openShared(friend)}>
                <Trophy size={15} /> Shared progress
              </button>
              <button
                className="outline-button"
                disabled={myChallenges.length === 0}
                onClick={() => {
                  setInviteFor(friend);
                  setInviteChallengeId(myChallenges[0]?.challengeId ?? '');
                }}
              >
                <Plus size={15} /> Invite
              </button>
              <button
                className="icon-button"
                aria-label={`Remove ${friend.name}`}
                onClick={() => setRemovingFriend(friend)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
        <p className="mut">
          Dost ko challenge me bulana ho to Challenges screen se invite bhejo — wo accept kare tabhi judta hai.
        </p>
        {removingFriend && (
          <div className="friend-confirm">
            <p>
              Remove <strong>{removingFriend.name}</strong> from your friends? You will no
              longer see each other&apos;s shared challenge progress.
            </p>
            <div className="friend-actions">
              <button
                className="primary-button"
                disabled={busy === 'remove-friend'}
                onClick={() =>
                  run('remove-friend', async () => {
                    await removeFriend(removingFriend.id);
                    if (selectedFriend?.id === removingFriend.id) {
                      setSelectedFriend(null);
                      setShared([]);
                    }
                    setRemovingFriend(null);
                    onNotify(`${removingFriend.name} removed from your friends.`);
                  })
                }
              >
                Remove friend
              </button>
              <button className="outline-button" onClick={() => setRemovingFriend(null)}>
                Keep them
              </button>
            </div>
          </div>
        )}
        {inviteFor && (
          <div className="friend-confirm">
            <p>
              Invite <strong>{inviteFor.name}</strong> to one of your challenges. They join
              only if they accept — and only the shared challenge progress is visible to
              each other.
            </p>
            {myChallenges.length === 0 ? (
              <p className="mut">
                You are not taking part in any challenge yet. Join a challenge first.
              </p>
            ) : (
              <>
                <select
                  className="form-input"
                  value={inviteChallengeId}
                  onChange={(e) => setInviteChallengeId(e.target.value)}
                  aria-label="Choose a challenge"
                >
                  {myChallenges.map((p) => (
                    <option key={p.challengeId} value={p.challengeId}>
                      {p.challenge.title} — Day {p.currentDay} of {p.totalDays}
                    </option>
                  ))}
                </select>
                <div className="friend-actions">
                  <button
                    className="primary-button"
                    disabled={!inviteChallengeId || busy === 'send-invite'}
                    onClick={() =>
                      run('send-invite', async () => {
                        await sendChallengeInvite(inviteChallengeId, inviteFor.id);
                        setInviteFor(null);
                        onNotify(`Challenge invitation sent to ${inviteFor.name}.`);
                      })
                    }
                  >
                    Send invitation
                  </button>
                  <button className="outline-button" onClick={() => setInviteFor(null)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="acard-l">
        <h5>Challenge invitations</h5>
        {invitesIn.length === 0 && invitesOut.length === 0 && (
          <p className="mut">No challenge invitations.</p>
        )}
        {invitesIn.map((invite) => (
          <div className="taskrow" key={invite.id}>
            <span className="snum2">{invite.other?.initial ?? '?'}</span>
            <div>
              <strong>{invite.challenge?.title ?? 'A challenge'}</strong>
              <small>
                {invite.other?.name ?? 'A friend'} invited you ·{' '}
                {invite.challenge?.durationDays ?? ''} days
              </small>
            </div>
            <div className="friend-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setAcceptingInvite(invite);
                  setConsentChecked(false);
                }}
              >
                Accept
              </button>
              <button
                className="outline-button"
                disabled={busy === `decline-invite-${invite.id}`}
                onClick={() =>
                  run(`decline-invite-${invite.id}`, async () => {
                    await declineChallengeInvite(invite.id);
                    onNotify('Challenge invitation declined.');
                  })
                }
              >
                Decline
              </button>
            </div>
          </div>
        ))}
        {invitesOut.map((invite) => (
          <div className="taskrow" key={invite.id}>
            <span className="snum2">{invite.other?.initial ?? '?'}</span>
            <div>
              <strong>{invite.challenge?.title ?? 'A challenge'}</strong>
              <small>Invitation sent to {invite.other?.name ?? 'them'} — waiting</small>
            </div>
          </div>
        ))}
        {acceptingInvite && (
          <div className="friend-confirm">
            <p>
              Join <strong>{acceptingInvite.challenge?.title ?? 'this challenge'}</strong>?
              The rules of the challenge apply, and your progress on it becomes visible to
              {acceptingInvite.other?.name ? ` ${acceptingInvite.other.name}` : ' your friend'} —
              only the challenge name, day, completed days and points.
            </p>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>I understand the rules and join with my consent.</span>
            </label>
            <div className="friend-actions">
              <button
                className="primary-button"
                disabled={!consentChecked || busy === 'accept-invite'}
                onClick={() =>
                  run('accept-invite', async () => {
                    await acceptChallengeInvite(acceptingInvite.id);
                    setAcceptingInvite(null);
                    onNotify(`You joined "${acceptingInvite.challenge?.title ?? 'the challenge'}".`);
                  })
                }
              >
                Join challenge
              </button>
              <button className="outline-button" onClick={() => setAcceptingInvite(null)}>
                Not now
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedFriend && (
        <div className="acard-l">
          <h5>Shared progress with {selectedFriend.name}</h5>
          <p className="mut">
            Only challenges you both take part in are shown, and only these fields: challenge
            name, current day, completed days, progress and points earned. Nothing else about
            either of you is shared.
          </p>
          {sharedLoading && <p className="mut">Loading shared progress…</p>}
          {!sharedLoading && shared.length === 0 && (
            <p className="mut">
              No shared challenges yet. Invite {selectedFriend.name} to one of your challenges.
            </p>
          )}
          {shared.map((item) => (
            <div className="shared-challenge" key={item.challengeId}>
              <div className="shared-challenge-head">
                <strong>{item.challengeTitle}</strong>
                <span>{item.category}</span>
              </div>
              <SharedProgressRow label="You" progress={item.mine} />
              <SharedProgressRow label={selectedFriend.name} progress={item.friend} />
            </div>
          ))}
          <button className="outline-button" onClick={() => setSelectedFriend(null)}>
            Close shared view
          </button>
        </div>
      )}

      <div className="acard-l sc-privacy">
        <p>
          🔒 <b>Privacy pakki:</b> dost sirf challenge ka naam, din, progress aur points dekhte hain. Tumhare tasks, neend, profile ya namaz ki tafseel private rehti hai.
        </p>
      </div>
    </section>
  );
}

function SharedProgressRow({
  label,
  progress,
}: {
  label: string;
  progress: { currentDay: number; totalDays: number; completedDays: number; pointsEarned: number; status: string };
}) {
  const percent =
    progress.totalDays > 0
      ? Math.min(100, Math.round((progress.completedDays / progress.totalDays) * 100))
      : 0;
  return (
    <div className="shared-progress-row">
      <div className="shared-progress-label">
        <strong>{label}</strong>
        <span>
          Day {progress.currentDay} of {progress.totalDays} · {progress.completedDays} days
          done · {progress.pointsEarned} points
          {progress.status === 'completed' ? ' · Completed' : ''}
        </span>
      </div>
      <div className="shared-progress-bar" aria-label={`${label}: ${percent}% complete`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
