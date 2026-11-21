import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, Search, Trophy, UserPlus, X } from 'lucide-react';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';
import {
  acceptChallengeInvite,
  acceptFriendRequest,
  cancelFriendRequest,
  declineChallengeInvite,
  fetchDiscoverUsers,
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
  language,
}: {
  onNotify: (message: string) => void;
  refreshKey: number;
  guestMode: boolean;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [discover, setDiscover] = useState<PublicUser[]>([]);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [discoverFailed, setDiscoverFailed] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [invitesIn, setInvitesIn] = useState<ChallengeInvite[]>([]);
  const [invitesOut, setInvitesOut] = useState<ChallengeInvite[]>([]);
  const [myChallenges, setMyChallenges] = useState<ChallengeParticipation[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [shared, setShared] = useState<SharedChallenge[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [inviteFor, setInviteFor] = useState<PublicUser | null>(null);
  const [inviteChallengeId, setInviteChallengeId] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState<ChallengeInvite | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [removingFriend, setRemovingFriend] = useState<Friend | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function refresh() {
    if (guestMode) return;
    try {
      const [friendsResult, requestsResult, invitesResult, mineResult, discoverResult] =
        await Promise.allSettled([
          fetchFriends(),
          fetchFriendRequests(),
          fetchInvites(),
          fetchMyChallenges(),
          fetchDiscoverUsers(),
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
      if (discoverResult.status === 'fulfilled') {
        setDiscover(discoverResult.value);
        setDiscoverFailed(false);
      } else {
        setDiscoverFailed(true);
      }
      setDiscoverLoaded(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : s.friends.loadFailed);
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
      const message = err instanceof Error ? err.message : s.friends.somethingWrong;
      setError(message);
      onNotify(message);
    } finally {
      setBusy('');
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) {
      onNotify(s.friends.searchNeedsTwo);
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery.trim()));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.friends.searchFailed);
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
      onNotify(err instanceof Error ? err.message : s.friends.sharedFailed);
    } finally {
      setSharedLoading(false);
    }
  }

  if (guestMode) {
    return (
      <section className="sc-friends">
        <PageHeading
          eyebrow={s.friends.eyebrow}
          title={s.friends.title}
          text={s.friends.textGuest}
        />
        <div className="acard-l">
          <p className="mut">
            {s.friends.guestText}
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
        eyebrow={s.friends.eyebrow}
        title={s.friends.title}
        text={s.friends.textMain}
      />

      {error && <p className="form-error">{error}</p>}

      <div className="acard-l">
        <h5>{s.friends.findTitle}</h5>
        <p className="mut">
          {s.friends.findText}
        </p>
        <form className="friend-search" onSubmit={handleSearch}>
          <Search size={16} />
          <input
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={s.friends.searchPlaceholder}
            aria-label={s.friends.searchAria}
          />
          <button className="primary-button" type="submit" disabled={searching}>
            {searching ? s.friends.searching : s.friends.search}
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
                    <small>{isFriend ? s.friends.alreadyFriend : pending ? s.friends.requestSent : s.friends.ahdoraUser}</small>
                  </div>
                  {!isFriend && !pending && (
                    <button
                      className="outline-button"
                      disabled={busy === `add-${person.id}`}
                      onClick={() =>
                        run(`add-${person.id}`, async () => {
                          await sendFriendRequest(person.id);
                          onNotify(s.friends.requestSentTo(person.name));
                        })
                      }
                    >
                      <UserPlus size={15} /> {s.friends.addFriend}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
          <p className="mut">{s.friends.noUsersFound}</p>
        )}
      </div>

      <div className="acard-l">
        <h5>{s.friends.discoverTitle}</h5>
        <p className="mut">
          {s.friends.discoverText}
        </p>
        {!discoverLoaded && <p className="mut">{s.friends.loading}</p>}
        {discoverLoaded && discoverFailed && (
          <div>
            <p className="mut">{s.friends.discoverFailed}</p>
            <button className="outline-button" onClick={() => refresh()}>
              {s.friends.retry}
            </button>
          </div>
        )}
        {discoverLoaded && !discoverFailed && discover.length === 0 && (
          <p className="mut">{s.friends.noDiscover}</p>
        )}
        {discover.map((person) => {
          const isFriend = friendIds.has(person.id);
          const pending = pendingOutgoingIds.has(person.id);
          return (
            <div className="taskrow" key={person.id}>
              <span className="snum2">{person.initial}</span>
              <div>
                <strong>{person.name}</strong>
                <small>{isFriend ? s.friends.alreadyFriend : pending ? s.friends.requestSent : s.friends.ahdoraUser}</small>
              </div>
              <div className="friend-actions">
                {!isFriend && !pending && (
                  <button
                    className="outline-button"
                    disabled={busy === `add-${person.id}`}
                    onClick={() =>
                      run(`add-${person.id}`, async () => {
                        await sendFriendRequest(person.id);
                        onNotify(s.friends.requestSentTo(person.name));
                      })
                    }
                  >
                    <UserPlus size={15} /> {s.friends.addFriend}
                  </button>
                )}
                <button
                  className="outline-button"
                  onClick={() => {
                    setInviteFor(person);
                    setInviteChallengeId(myChallenges[0]?.challengeId ?? '');
                  }}
                >
                  <Plus size={15} /> {s.friends.inviteToChallenge}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {inviteFor && (
        <div className="acard-l">
          <h5>{s.friends.inviteTitle(inviteFor.name)}</h5>
          {friendIds.has(inviteFor.id) ? (
            <>
              <p>{s.friends.inviteText(inviteFor.name)}</p>
              {myChallenges.length === 0 ? (
                <p className="mut">
                  {s.friends.inviteNoChallenge}
                </p>
              ) : (
                <>
                  <select
                    className="form-input"
                    value={inviteChallengeId}
                    onChange={(e) => setInviteChallengeId(e.target.value)}
                    aria-label={s.friends.chooseChallenge}
                  >
                    {myChallenges.map((p) => (
                      <option key={p.challengeId} value={p.challengeId}>
                        {s.friends.inviteOption(p.challenge.title, p.currentDay, p.totalDays)}
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
                          onNotify(s.friends.invitationSent(inviteFor.name));
                        })
                      }
                    >
                      {s.friends.sendInvitation}
                    </button>
                    <button className="outline-button" onClick={() => setInviteFor(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p>{s.friends.inviteFriendsOnly(inviteFor.name)}</p>
              <div className="friend-actions">
                {pendingOutgoingIds.has(inviteFor.id) ? (
                  <p className="mut">{s.friends.requestWaiting}</p>
                ) : (
                  <button
                    className="primary-button"
                    disabled={busy === `add-${inviteFor.id}`}
                    onClick={() =>
                      run(`add-${inviteFor.id}`, async () => {
                        await sendFriendRequest(inviteFor.id);
                        setInviteFor(null);
                        onNotify(`Friend request sent to ${inviteFor.name}.`);
                      })
                    }
                  >
                    <UserPlus size={15} /> {s.friends.sendFriendRequest}
                  </button>
                )}
                <button className="outline-button" onClick={() => setInviteFor(null)}>
                  {s.friends.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="acard-l">
        <h5>{s.friends.requestsTitle(incoming.length)}</h5>
        {incoming.length === 0 && outgoing.length === 0 && (
          <p className="mut">{s.friends.noRequests}</p>
        )}
        {incoming.map((request) => (
          <div className="taskrow" key={request.id}>
            <span className="snum2 av-peach">{request.other?.initial ?? '?'}</span>
            <div>
              <strong>{request.other?.name ?? s.friends.unknownUser}</strong>
              <small>{s.friends.wantsToBeFriends}</small>
            </div>
            <div className="friend-actions">
              <button
                className="primary-button"
                disabled={busy === `accept-${request.id}`}
                onClick={() =>
                  run(`accept-${request.id}`, async () => {
                    await acceptFriendRequest(request.id);
                    onNotify(s.friends.nowFriends(request.other?.name ?? 'them'));
                  })
                }
              >
                <Check size={15} /> {s.friends.accept}
              </button>
              <button
                className="outline-button"
                disabled={busy === `reject-${request.id}`}
                onClick={() =>
                  run(`reject-${request.id}`, async () => {
                    await rejectFriendRequest(request.id);
                    onNotify(s.friends.requestDeclined);
                  })
                }
              >
                {s.friends.decline}
              </button>
            </div>
          </div>
        ))}
        {outgoing.map((request) => (
          <div className="taskrow" key={request.id}>
            <span className="snum2">{request.other?.initial ?? '?'}</span>
            <div>
              <strong>{request.other?.name ?? s.friends.unknownUser}</strong>
              <small>{s.friends.requestSentWaiting}</small>
            </div>
            <button
              className="outline-button"
              disabled={busy === `cancel-${request.id}`}
              onClick={() =>
                run(`cancel-${request.id}`, async () => {
                  await cancelFriendRequest(request.id);
                  onNotify(s.friends.requestCancelled);
                })
              }
            >
              {s.friends.cancel}
            </button>
          </div>
        ))}
      </div>

      <div className="acard-l">
        <h5>{s.friends.friendsTitle(friends.length)}</h5>
        {friends.length === 0 && (
          <p className="mut">
            {s.friends.noFriends}
          </p>
        )}
        {friends.map((friend) => (
          <div className="taskrow" key={friend.id}>
            <span className="snum2">{friend.initial}</span>
            <div>
              <strong>{friend.name}</strong>
              <small>{s.friends.friendsSince(new Date(friend.since).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</small>
            </div>
            <div className="friend-actions">
              <button className="outline-button" onClick={() => openShared(friend)}>
                <Trophy size={15} /> {s.friends.sharedProgress}
              </button>
              <button
                className="outline-button"
                disabled={myChallenges.length === 0}
                onClick={() => {
                  setInviteFor(friend);
                  setInviteChallengeId(myChallenges[0]?.challengeId ?? '');
                }}
              >
                <Plus size={15} /> {s.friends.invite}
              </button>
              <button
                className="icon-button"
                aria-label={s.friends.removeAria(friend.name)}
                onClick={() => setRemovingFriend(friend)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
        <p className="mut">
          {s.friends.inviteHint}
        </p>
        {removingFriend && (
          <div className="friend-confirm">
            <p>
              {s.friends.removeConfirm(removingFriend.name)}
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
                    onNotify(s.friends.friendRemoved(removingFriend.name));
                  })
                }
              >
                {s.friends.removeFriend}
              </button>
              <button className="outline-button" onClick={() => setRemovingFriend(null)}>
                {s.friends.keepThem}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="acard-l">
        <h5>{s.friends.invitesTitle}</h5>
        {invitesIn.length === 0 && invitesOut.length === 0 && (
          <p className="mut">{s.friends.noInvites}</p>
        )}
        {invitesIn.map((invite) => (
          <div className="taskrow" key={invite.id}>
            <span className="snum2">{invite.other?.initial ?? '?'}</span>
            <div>
              <strong>{invite.challenge?.title ?? 'A challenge'}</strong>
              <small>{s.friends.invitedYou(invite.other?.name ?? 'A friend', invite.challenge?.durationDays ?? '')}</small>
            </div>
            <div className="friend-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setAcceptingInvite(invite);
                  setConsentChecked(false);
                }}
              >
                {s.friends.accept}
              </button>
              <button
                className="outline-button"
                disabled={busy === `decline-invite-${invite.id}`}
                onClick={() =>
                  run(`decline-invite-${invite.id}`, async () => {
                    await declineChallengeInvite(invite.id);
                    onNotify(s.friends.inviteDeclined);
                  })
                }
              >
                {s.friends.decline}
              </button>
            </div>
          </div>
        ))}
        {invitesOut.map((invite) => (
          <div className="taskrow" key={invite.id}>
            <span className="snum2">{invite.other?.initial ?? '?'}</span>
            <div>
              <strong>{invite.challenge?.title ?? 'A challenge'}</strong>
              <small>{s.friends.inviteSentWaiting(invite.other?.name ?? 'them')}</small>
            </div>
          </div>
        ))}
        {acceptingInvite && (
          <div className="friend-confirm">
            <p>
              {s.friends.joinTitle(acceptingInvite.challenge?.title ?? 'this challenge')}{' '}
              {s.friends.joinText(acceptingInvite.other?.name ?? 'your friend')}
            </p>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>{s.friends.joinConsent}</span>
            </label>
            <div className="friend-actions">
              <button
                className="primary-button"
                disabled={!consentChecked || busy === 'accept-invite'}
                onClick={() =>
                  run('accept-invite', async () => {
                    await acceptChallengeInvite(acceptingInvite.id);
                    setAcceptingInvite(null);
                    onNotify(s.friends.joinedChallenge(acceptingInvite.challenge?.title ?? 'the challenge'));
                  })
                }
              >
                {s.friends.joinChallenge}
              </button>
              <button className="outline-button" onClick={() => setAcceptingInvite(null)}>
                {s.friends.notNow}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedFriend && (
        <div className="acard-l">
          <h5>{s.friends.sharedTitle(selectedFriend.name)}</h5>
          <p className="mut">
            {s.friends.sharedText}
          </p>
          {sharedLoading && <p className="mut">{s.friends.sharedLoading}</p>}
          {!sharedLoading && shared.length === 0 && (
            <p className="mut">
              {s.friends.noShared(selectedFriend.name)}
            </p>
          )}
          {shared.map((item) => (
            <div className="shared-challenge" key={item.challengeId}>
              <div className="shared-challenge-head">
                <strong>{item.challengeTitle}</strong>
                <span>{item.category}</span>
              </div>
              <SharedProgressRow label={s.friends.you} progress={item.mine} language={language} />
              <SharedProgressRow label={selectedFriend.name} progress={item.friend} language={language} />
            </div>
          ))}
          <button className="outline-button" onClick={() => setSelectedFriend(null)}>
            {s.friends.closeShared}
          </button>
        </div>
      )}

      <div className="acard-l sc-privacy">
        <p>
          {s.friends.privacy}
        </p>
      </div>
    </section>
  );
}

function SharedProgressRow({
  label,
  progress,
  language,
}: {
  label: string;
  progress: { currentDay: number; totalDays: number; completedDays: number; pointsEarned: number; status: string };
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const percent =
    progress.totalDays > 0
      ? Math.min(100, Math.round((progress.completedDays / progress.totalDays) * 100))
      : 0;
  return (
    <div className="shared-progress-row">
      <div className="shared-progress-label">
        <strong>{label}</strong>
        <span>
          {s.friends.sharedLine(progress.currentDay, progress.totalDays, progress.completedDays, progress.pointsEarned)}
          {progress.status === 'completed' ? s.friends.sharedCompleted : ''}
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
