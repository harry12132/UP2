import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, type User,
} from 'firebase/auth';
import {
  ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, Clock3, Compass,
  Heart, LogOut, MapPin, MessageCircle, Plus, Search, Sparkles, Users, X,
  ImagePlus, Share2, Send, Trash2,
} from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { supabase } from './supabase';

type Profile = { uid: string; displayName: string; photoURL?: string; bio?: string };
type Post = { id: string; authorId: string; authorName: string; authorPhoto?: string; text: string; visibility: string; mediaUrl?: string; mediaType?: string; createdAt?: { toDate?: () => Date } };
type CommentItem = { id: string; authorId: string; authorName: string; authorPhoto?: string; text: string; createdAt?: { toDate?: () => Date } };
type EventItem = { id: string; hostId: string; hostName: string; title: string; description?: string; location?: string; startsAt: string; visibility: 'public' | 'selected'; invitedUids: string[]; attendeeUids: string[]; createdAt?: { toDate?: () => Date } };
type Notice = { id: string; recipientId: string; actorId: string; actorName: string; type: string; eventId: string; eventTitle: string; createdAt?: { toDate?: () => Date }; read?: boolean };
type Conversation = { id:string; type:'direct'|'event'; members:string[]; memberNames?:Record<string,string>; eventId?:string; eventTitle?:string; title?:string; lastMessage?:string; lastSenderId?:string; updatedAt?:{toDate?:()=>Date} };
type ChatMessage = { id:string; senderId:string; senderName:string; text:string; createdAt?:{toDate?:()=>Date} };
type EventPhoto = { id:string; authorId:string; authorName:string; url:string; mediaType?:string; createdAt?:{toDate?:()=>Date} };
type FollowRequest = { id: string; requesterId: string; requesterName: string; requesterPhoto?: string; targetId: string; status: 'pending' | 'accepted' | 'declined'; createdAt?: { toDate?: () => Date } };
type Tab = 'home' | 'events' | 'messages' | 'memories' | 'people' | 'invites' | 'profile';

const timeAgo = (value?: { toDate?: () => Date }) => {
  const date = value?.toDate?.();
  if (!date) return 'just now';
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  return Math.floor(mins / 1440) + 'd ago';
};
const initials = (name = 'U') => name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const niceDate = (value: string) => {
  if (!value) return 'Date to be confirmed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
};

function Avatar({ name, photo, size = 'normal' }: { name: string; photo?: string; size?: 'normal' | 'small' | 'large' }) {
  return <span className={'avatar avatar-' + size}>{photo ? <img src={photo} alt="" /> : initials(name)}</span>;
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      let user: User;
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        user = result.user;
        await updateProfile(user, { displayName: name.trim() || email.split('@')[0] });
      } else {
        user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
      }
      await ensureProfile(user);
    } catch (err) { setError(authError(err)); }
    finally { setBusy(false); }
  }
  async function google() {
    setError(''); setBusy(true);
    try { const result = await signInWithPopup(auth, googleProvider); await ensureProfile(result.user); }
    catch (err) { setError(authError(err)); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-side">
      <div className="brand brand-light"><span className="brand-mark">u<span>2</span></span><span>UP2</span></div>
      <div className="auth-hero">
        <span className="eyebrow eyebrow-light"><span className="live-dot" /> A LITTLE MORE LIFE</span>
        <h1>Less feed.<br /><em>More living.</em></h1>
        <p>Your friends, your plans, your life. A social network built to bring people together, not keep them scrolling.</p>
        <div className="hero-stamp"><Sparkles size={15} /> Made for real life in Aotearoa</div>
      </div>
      <div className="auth-bottom">THE INTERNET, BACK IN YOUR HANDS.</div>
    </div>
    <div className="auth-form-wrap">
      <div className="mobile-brand brand"><span className="brand-mark">u<span>2</span></span><span>UP2</span></div>
      <div className="auth-form">
        <div className="form-kicker">{mode === 'signup' ? 'YOUR PEOPLE ARE HERE' : 'GOOD TO HAVE YOU BACK'}</div>
        <h2>{mode === 'signup' ? 'Life’s happening.' : 'Welcome back.'}</h2>
        <p className="muted">{mode === 'signup' ? 'Make an account and get in on it.' : 'Pick up where real life left off.'}</p>
        <button className="google-button" onClick={google} disabled={busy}><span className="google-g">G</span> Continue with Google <ArrowUpRight size={16} /></button>
        <div className="separator"><span />or use your email<span /></div>
        <form onSubmit={submit} className="stack-form">
          {mode === 'signup' && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="What do your friends call you?" autoComplete="name" /></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="button button-dark full-width" disabled={busy}>{busy ? 'One sec…' : mode === 'signup' ? 'Create your account' : 'Log in'} <ArrowUpRight size={16} /></button>
        </form>
        <p className="auth-switch">{mode === 'signup' ? 'Already one of us?' : 'New around here?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Log in' : 'Create an account'}</button></p>
        <p className="legal-note">By joining, you agree to be kind, respect people’s privacy, and help make online life a little better.</p>
      </div>
    </div>
  </main>;
}

async function ensureProfile(user: User) {
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);
  const displayName = existing.exists() ? String(existing.data().displayName || user.displayName || user.email?.split('@')[0] || 'New friend') : (user.displayName || user.email?.split('@')[0] || 'New friend');
  const photoURL = existing.exists() ? String(existing.data().photoURL || user.photoURL || '') : (user.photoURL || '');
  if (!existing.exists()) await setDoc(ref, { displayName, photoURL, bio: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  // Minimal public directory is separate from private bio and profile details.
  await setDoc(doc(db, 'directory', user.uid), { displayName, photoURL, updatedAt: serverTimestamp() }, { merge: true });
}
function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'That email already has an account. Try logging in.',
    'auth/invalid-credential': 'Email or password looks incorrect. Give it another go.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/unauthorized-domain': 'This domain needs to be authorised in Firebase Authentication settings.',
    'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication.',
    'permission-denied': 'Firestore rejected this action (permission-denied). The updated Firestore rules may not be deployed yet. In the browser console, check the full error and run: firebase deploy --only firestore:rules',
    'firestore/permission-denied': 'Firestore rejected this action (permission-denied). The updated Firestore rules may not be deployed yet. In the browser console, check the full error and run: firebase deploy --only firestore:rules',
    'storage/unauthorized': 'Storage rejected the upload. Check the storage provider credentials and access policies.',
    'unavailable': 'Firebase is temporarily unavailable. Check your connection and try again.',
    'failed-precondition': 'Firebase needs a database index or configuration change. Check the browser console for the full error.',
  };
  return messages[code || ''] || (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [acceptedFollowing, setAcceptedFollowing] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FollowRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FollowRequest[]>([]);
  const [profilePageUid, setProfilePageUid] = useState('');
  const [profileDetails, setProfileDetails] = useState<Profile | null>(null);
  const [profilePagePosts, setProfilePagePosts] = useState<Post[]>([]);
  const [profilePageUnlocked, setProfilePageUnlocked] = useState(false);
  const [profileBioDraft, setProfileBioDraft] = useState('');
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [profileFollowers, setProfileFollowers] = useState<Profile[]>([]);
  const [profileFollowing, setProfileFollowing] = useState<Profile[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [eventPhotos, setEventPhotos] = useState<Record<string,EventPhoto[]>>({});
  const [uploadingAlbumFor, setUploadingAlbumFor] = useState('');
  const [postText, setPostText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [postLikes, setPostLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [postComments, setPostComments] = useState<Record<string, CommentItem[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventVisibility, setEventVisibility] = useState<'public' | 'selected'>('selected');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [toast, setToast] = useState('');
  const followingIds = [...new Set([...following, ...acceptedFollowing])];

  // Clear user-scoped data on account changes so private content never carries into another session.
  useEffect(() => {
    setPosts([]); setEvents([]); setPeople([]); setFollowing([]); setAcceptedFollowing([]);
    setIncomingRequests([]); setOutgoingRequests([]); setNotices([]); setConversations([]);
    setActiveConversationId(''); setChatMessages([]); setEventPhotos({}); setPostLikes({}); setPostComments({});
    setProfileDetails(null); setProfilePagePosts([]); setProfilePageUnlocked(false); setProfileFollowers([]); setProfileFollowing([]);
    setProfilePageUid(user?.uid || '');
    if (!user) setTab('home');
  }, [user?.uid]);

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current);

    if (!current) {
      setProfile(null);
      return;
    }

    try {
      // Repair missing profile documents for users who signed in before profile creation completed.
      await ensureProfile(current);
    } catch (err) {
      console.error('Profile setup failed:', err);
      setToast('Could not set up your profile: ' + authError(err));
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setProfile({ uid: user.uid, ...snap.data() } as Profile);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', user.uid, 'following'), snap => setFollowing(snap.docs.map(d => d.id)), err => console.error('Legacy following:', err));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(query(collection(db, 'followRequests'), where('requesterId', '==', user.uid), where('status', '==', 'accepted')), snap => setAcceptedFollowing(snap.docs.map(d => String(d.data().targetId))), err => console.error('Accepted following:', err)),
      onSnapshot(query(collection(db, 'followRequests'), where('targetId', '==', user.uid), where('status', '==', 'pending')), snap => setIncomingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as FollowRequest))), err => console.error('Incoming follow requests:', err)),
      onSnapshot(query(collection(db, 'followRequests'), where('requesterId', '==', user.uid), where('status', '==', 'pending')), snap => setOutgoingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as FollowRequest))), err => console.error('Outgoing follow requests:', err)),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [user]);

  useEffect(() => {
    if (!mediaFile) { setMediaPreview(''); return; }
    const previewUrl = URL.createObjectURL(mediaFile);
    setMediaPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [mediaFile]);

  useEffect(() => {
    if (!user || posts.length === 0) return;
    const unsubs: (() => void)[] = [];
    posts.forEach(post => {
      // Live subscriptions keep likes and comment threads in sync across devices.
      unsubs.push(onSnapshot(collection(db, 'posts', post.id, 'likes'), snap => {
        setPostLikes(prev => ({ ...prev, [post.id]: { count: snap.size, liked: snap.docs.some(d => d.id === user.uid) } }));
      }, err => console.error('Post likes:', err)));
      unsubs.push(onSnapshot(query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'), limit(50)), snap => {
        setPostComments(prev => ({ ...prev, [post.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentItem)) }));
      }, err => console.error('Post comments:', err)));
    });
    return () => unsubs.forEach(unsub => unsub());
  }, [user, posts.map(post => post.id).join('|')]);

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    const allPosts = new Map<string, Post>();
    const publish = () => setPosts([...allPosts.values()].sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0)));
    unsubs.push(onSnapshot(query(collection(db, 'posts'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'), limit(30)), snap => {
      snap.docs.forEach(d => allPosts.set(d.id, { id: d.id, ...d.data() } as Post)); publish();
    }, err => console.error('Your posts:', err)));
    followingIds.slice(0, 20).forEach(uid => {
      unsubs.push(onSnapshot(query(collection(db, 'posts'), where('authorId', '==', uid), where('visibility', 'in', ['public', 'followers']), orderBy('createdAt', 'desc'), limit(20)), snap => {
        snap.docs.forEach(d => allPosts.set(d.id, { id: d.id, ...d.data() } as Post)); publish();
      }, err => console.error('Friend posts:', err)));
    });
    return () => unsubs.forEach(fn => fn());
  }, [user, followingIds.join('|')]);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get('post');
    if (!postId) return;
    const loadedPost = posts.some(post => post.id === postId);
    if (loadedPost) {
      document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Shared links can open a post directly, even if its author is not followed.
    getDoc(doc(db, 'posts', postId)).then(snap => {
      if (snap.exists()) setPosts(prev => prev.some(post => post.id === snap.id) ? prev : [{ id: snap.id, ...snap.data() } as Post, ...prev]);
    }).catch(err => console.error('Shared post:', err));
  }, [posts]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, 'conversations'), where('members', 'array-contains', user.uid), limit(100)), snap => setConversations(snap.docs.map(d => ({id:d.id,...d.data()} as Conversation)).sort((a,b)=>(b.updatedAt?.toDate?.().getTime()||0)-(a.updatedAt?.toDate?.().getTime()||0))), err => console.error('Conversations:',err));
  }, [user]);

  useEffect(() => {
    if (!user || !activeConversationId) { setChatMessages([]); return; }
    return onSnapshot(query(collection(db,'conversations',activeConversationId,'messages'),orderBy('createdAt','asc'),limit(100)),snap=>setChatMessages(snap.docs.map(d=>({id:d.id,...d.data()} as ChatMessage))),err=>console.error('Messages:',err));
  },[user,activeConversationId]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(query(collection(db, 'events'), where('visibility', '==', 'public'), orderBy('startsAt', 'asc'), limit(40)), snap => {
        setEvents(prev => mergeEvents(prev, snap.docs.map(d => ({ id: d.id, ...d.data() } as EventItem))));
      }, err => console.error('Public events:', err)),
      onSnapshot(query(collection(db, 'events'), where('invitedUids', 'array-contains', user.uid), limit(40)), snap => {
        setEvents(prev => mergeEvents(prev, snap.docs.map(d => ({ id: d.id, ...d.data() } as EventItem))));
      }, err => console.error('Invited events:', err)),
      onSnapshot(query(collection(db, 'events'), where('hostId', '==', user.uid), limit(40)), snap => {
        setEvents(prev => mergeEvents(prev, snap.docs.map(d => ({ id: d.id, ...d.data() } as EventItem))));
      }, err => console.error('Hosted events:', err)),
      onSnapshot(query(collection(db, 'notifications'), where('recipientId', '==', user.uid), orderBy('createdAt', 'desc'), limit(30)), snap => {
        setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      }, err => console.error('Notifications:', err)),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'directory'), limit(100))).then(snap => {
      setPeople(snap.docs.filter(d => d.id !== user.uid).map(d => ({ uid: d.id, ...d.data() } as Profile)));
    }).catch(err => console.error('People directory:', err));
  }, [user]);

  useEffect(() => {
    if (!user || !profilePageUid) return;
    const isOwn = profilePageUid === user.uid;
    const directoryProfile = isOwn ? profile : (people.find(person => person.uid === profilePageUid) || null);
    if (!isOwn && !followingIds.includes(profilePageUid)) {
      setProfileDetails(directoryProfile);
      setProfilePagePosts([]);
      setProfilePageUnlocked(false);
      return;
    }
    setProfilePageUnlocked(true);
    const profileRef = doc(db, 'users', profilePageUid);
    const unsubProfile = isOwn ? undefined : onSnapshot(profileRef, snap => {
      if (snap.exists()) {
        const value = { uid: profilePageUid, ...snap.data() } as Profile;
        setProfileDetails(value);
      }
    }, err => { console.error('Private profile:', err); setProfilePageUnlocked(false); });
    if (isOwn && profile) setProfileDetails(profile);
    const unsubPosts = onSnapshot(query(collection(db, 'posts'), where('authorId', '==', profilePageUid), orderBy('createdAt', 'desc'), limit(60)), snap => {
      setProfilePagePosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    }, err => { console.error('Profile posts:', err); setProfilePagePosts([]); });
    if (isOwn) {
      setProfileNameDraft(profile?.displayName || '');
      setProfileBioDraft(profile?.bio || '');
    }
    return () => { unsubProfile?.(); unsubPosts(); };
  }, [user, profilePageUid, profile, people, followingIds.join('|')]);

  useEffect(() => {
    if (!user || !profilePageUid) return;
    const isOwn = profilePageUid === user.uid;
    const canSeeRelations = isOwn || followingIds.includes(profilePageUid);
    if (!canSeeRelations) { setProfileFollowers([]); setProfileFollowing([]); return; }
    const loadProfiles = async (ids: string[]) => Promise.all(ids.map(async uid => {
      try {
        const snap = await getDoc(doc(db, 'directory', uid));
        return snap.exists() ? ({ uid, ...snap.data() } as Profile) : null;
      } catch { return null; }
    })).then(items => items.filter((item): item is Profile => Boolean(item)));
    const unsubFollowers = onSnapshot(query(collection(db, 'followRequests'), where('targetId', '==', profilePageUid), where('status', '==', 'accepted')), async snap => {
      setProfileFollowers(await loadProfiles(snap.docs.map(d => String(d.data().requesterId))));
    }, err => console.error('Profile followers:', err));
    const unsubFollowing = onSnapshot(query(collection(db, 'followRequests'), where('requesterId', '==', profilePageUid), where('status', '==', 'accepted')), async snap => {
      const ids = [...new Set([...snap.docs.map(d => String(d.data().targetId)), ...(isOwn ? following : [])])];
      setProfileFollowing(await loadProfiles(ids));
    }, err => console.error('Profile following:', err));
    return () => { unsubFollowers(); unsubFollowing(); };
  }, [user, profilePageUid, followingIds.join('|')]);

  useEffect(() => {
    if (!user) return;
    const mine=events.filter(e=>(e.attendeeUids||[]).includes(user.uid)||e.hostId===user.uid);
    const unsubs=mine.map(event=>onSnapshot(collection(db,'events',event.id,'photos'),snap=>setEventPhotos(prev=>({...prev,[event.id]:snap.docs.map(d=>({id:d.id,...d.data()} as EventPhoto))})),err=>console.error('Event album:',err)));
    return ()=>unsubs.forEach(unsub=>unsub());
  },[user,events.map(e=>e.id+':'+(e.attendeeUids||[]).join(',')).join('|')]);

  const invitedEvents = useMemo(() => events.filter(e => e.hostId !== user?.uid && e.invitedUids?.includes(user?.uid || '') && !e.attendeeUids?.includes(user?.uid || '')), [events, user]);
  const unread = notices.filter(n => !n.read).length;
  const filteredPeople = people.filter(p => p.displayName.toLowerCase().includes(peopleSearch.toLowerCase()));
  const followedProfiles = people.filter(p => followingIds.includes(p.uid));

  async function publishPost(e: FormEvent) {
    e.preventDefault();

    if (!user) {
      setToast('Please log in first.');
      return;
    }
    if (!profile) {
      setToast('Your profile is still loading. Please wait a moment and try again.');
      return;
    }
    if (!postText.trim() && !mediaFile) return;
    if (mediaFile && mediaFile.size > 100 * 1024 * 1024) { setToast('That file is over 100 MB. Choose a smaller photo or video.'); return; }
    if (mediaFile && !mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/')) { setToast('Choose an image or video file.'); return; }

    setSaving(true);
    setUploadingMedia(Boolean(mediaFile));
    try {
      let mediaUrl = '';
      let mediaType = '';
      if (mediaFile) {
        const safeName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `posts/${user.uid}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from('up2-media').upload(path, mediaFile, { contentType: mediaFile.type, upsert: false });
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from('up2-media').getPublicUrl(path).data.publicUrl;
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid, authorName: profile.displayName, authorPhoto: profile.photoURL || '',
        text: postText.trim(), visibility: 'followers', audienceUids: [],
        ...(mediaUrl ? { mediaUrl, mediaType } : {}), createdAt: serverTimestamp(),
      });
      setPostText(''); setMediaFile(null); setToast('Out there. Go live your life.'); setTimeout(() => setToast(''), 2800);
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 4000); }
    finally { setSaving(false); setUploadingMedia(false); }
  }

  async function toggleLike(post: Post) {
    if (!user) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    try {
      if (postLikes[post.id]?.liked) await deleteDoc(likeRef);
      else await setDoc(likeRef, { uid: user.uid, displayName: profile?.displayName || user.displayName || 'Someone', createdAt: serverTimestamp() });
    } catch (err) { console.error('Toggle post like failed:', err); setToast(authError(err)); setTimeout(() => setToast(''), 5000); }
  }

  async function addComment(post: Post, e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) { setToast('Your profile is still loading. Try again in a moment.'); return; }
    const text = (commentDrafts[post.id] || '').trim();
    if (!text) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorId: user.uid, authorName: profile.displayName, authorPhoto: profile.photoURL || '', text, createdAt: serverTimestamp(),
      });
      setCommentDrafts(prev => ({ ...prev, [post.id]: '' }));
    } catch (err) { console.error('Add post comment failed:', err); setToast(authError(err)); setTimeout(() => setToast(''), 5000); }
  }

  async function deleteComment(post: Post, comment: CommentItem) {
    if (!user || comment.authorId !== user.uid) return;
    try { await deleteDoc(doc(db, 'posts', post.id, 'comments', comment.id)); }
    catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: `UP2 · ${post.authorName}`, text: post.text || 'Check out this post on UP2', url });
      else { await navigator.clipboard.writeText(url); setToast('Post link copied. Send it to your people.'); setTimeout(() => setToast(''), 2800); }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(url); setToast('Post link copied.'); setTimeout(() => setToast(''), 2800); }
        catch { setToast('Sharing is unavailable in this browser.'); setTimeout(() => setToast(''), 2800); }
      }
    }
  }

  async function startConversation(person: Profile) {
    if (!user || !profile || person.uid === user.uid) return;
    const members = [user.uid, person.uid].sort();
    const id = 'dm_' + members.join('_');
    const ref = doc(db, 'conversations', id);
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const data = existing.data() as Conversation;
        if (data.type !== 'direct' || data.members.length !== 2 || !data.members.includes(user.uid) || !data.members.includes(person.uid)) throw new Error('This conversation has invalid participants. Please start a new conversation.');
      } else {
        await setDoc(ref, { type: 'direct', members, memberNames: { [user.uid]: profile.displayName, [person.uid]: person.displayName }, lastMessage: '', lastSenderId: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      setActiveConversationId(id); setTab('messages');
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function uploadEventPhoto(event: EventItem, file?: File) {
    if(!user||!profile||!file)return;
    if(!file.type.startsWith('image/')&&!file.type.startsWith('video/')){setToast('Choose a photo or video.');return;}
    if(file.size>100*1024*1024){setToast('That file is over 100 MB.');return;}
    setUploadingAlbumFor(event.id);
    try{
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=`events/${event.id}/${user.uid}/${Date.now()}_${safeName}`;
      const {error:uploadError}=await supabase.storage.from('up2-media').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const url=supabase.storage.from('up2-media').getPublicUrl(path).data.publicUrl;
      await addDoc(collection(db,'events',event.id,'photos'),{authorId:user.uid,authorName:profile.displayName,url,mediaType:file.type.startsWith('video/')?'video':'image',createdAt:serverTimestamp()});
      setToast('Added to the shared album.');setTimeout(()=>setToast(''),2500);
    }catch(err){setToast(authError(err));setTimeout(()=>setToast(''),3500)}finally{setUploadingAlbumFor('')}
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = messageDraft.trim();
    if (!user || !profile || !activeConversationId || !text) return;
    const conversation = conversations.find(c => c.id === activeConversationId);
    if (!conversation || !conversation.members.includes(user.uid)) { setToast('That conversation is no longer available.'); setTimeout(() => setToast(''), 3000); return; }
    if (conversation.type === 'direct' && conversation.members.length !== 2) { setToast('This direct message has invalid participants and was blocked.'); setTimeout(() => setToast(''), 3500); return; }
    try {
      await addDoc(collection(db, 'conversations', activeConversationId, 'messages'), { senderId: user.uid, senderName: profile.displayName, text, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'conversations', activeConversationId), { lastMessage: text.slice(0, 180), lastSenderId: user.uid, updatedAt: serverTimestamp() });
      setMessageDraft('');
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function followPerson(person: Profile) {
    if (!user || !profile || person.uid === user.uid) return;
    const id = `${person.uid}__${user.uid}`;
    const ref = doc(db, 'followRequests', id);
    const alreadyFollowing = followingIds.includes(person.uid);
    const pending = outgoingRequests.some(request => request.targetId === person.uid);
    try {
      if (alreadyFollowing) {
        if (acceptedFollowing.includes(person.uid)) await deleteDoc(ref);
        if (following.includes(person.uid)) await deleteDoc(doc(db, 'users', user.uid, 'following', person.uid));
        setToast('Unfollowed.');
      } else if (pending) {
        await deleteDoc(ref); setToast('Follow request cancelled.');
      } else {
        const existing = await getDoc(ref);
        const payload = { requesterId: user.uid, requesterName: profile.displayName, requesterPhoto: profile.photoURL || '', targetId: person.uid, status: 'pending', updatedAt: serverTimestamp() };
        if (existing.exists()) await updateDoc(ref, { ...payload, createdAt: serverTimestamp() });
        else await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
        setToast('Follow request sent.');
      }
      setTimeout(() => setToast(''), 2800);
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function respondToFollowRequest(request: FollowRequest, status: 'accepted' | 'declined') {
    if (!user || request.targetId !== user.uid || request.status !== 'pending') return;
    try {
      await updateDoc(doc(db, 'followRequests', request.id), { status, updatedAt: serverTimestamp() });
      setToast(status === 'accepted' ? `You accepted ${request.requesterName}'s follow request.` : 'Follow request declined.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile || profilePageUid !== user.uid) return;
    const displayName = profileNameDraft.trim().slice(0, 60);
    const bio = profileBioDraft.trim().slice(0, 160);
    if (!displayName) { setToast('Please add a display name.'); return; }
    setProfileSaveBusy(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName, bio, updatedAt: serverTimestamp() });
      await setDoc(doc(db, 'directory', user.uid), { displayName, photoURL: profile.photoURL || '', updatedAt: serverTimestamp() }, { merge: true });
      setToast('Profile updated.'); setTimeout(() => setToast(''), 2500);
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
    finally { setProfileSaveBusy(false); }
  }

  function openProfile(uid: string) { setProfilePageUid(uid); setTab('profile'); }

  async function createEvent(e: FormEvent) {
    e.preventDefault();

    if (!user) {
      setToast('Please log in first.');
      return;
    }
    if (!profile) {
      setToast('Your profile is still loading. Please wait a moment and try again.');
      return;
    }
    if (!eventTitle.trim() || !eventDate) return;

    setSaving(true);
    try {
      const inviteIds = eventVisibility === 'public' ? [] : invitees;
      const ref = await addDoc(collection(db, 'events'), {
        hostId: user.uid, hostName: profile.displayName, title: eventTitle.trim(),
        description: eventDescription.trim(), location: eventLocation.trim(), startsAt: new Date(eventDate).toISOString(),
        visibility: eventVisibility, invitedUids: inviteIds, attendeeUids: [user.uid],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db,'conversations',`event_${ref.id}`),{type:'event',eventId:ref.id,eventTitle:eventTitle.trim(),title:eventTitle.trim(),members:[...new Set([user.uid,...inviteIds])],memberNames:Object.fromEntries([{uid:user.uid,name:profile.displayName},...people.filter(p=>inviteIds.includes(p.uid)).map(p=>({uid:p.uid,name:p.displayName}))].map(x=>[x.uid,x.name])),lastMessage:'Event chat created',lastSenderId:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if (inviteIds.length) {
        await Promise.all(inviteIds.map(recipientId => addDoc(collection(db, 'notifications'), {
          recipientId, actorId: user.uid, actorName: profile.displayName, type: 'event_invite',
          eventId: ref.id, eventTitle: eventTitle.trim(), read: false, createdAt: serverTimestamp(),
        })));
      }
      setEventOpen(false); setEventTitle(''); setEventDescription(''); setEventLocation(''); setEventDate(''); setInvitees([]);
      setToast(eventVisibility === 'public' ? 'Event is live. Let the plans begin.' : 'Invitations sent.'); setTimeout(() => setToast(''), 3000);
      setTab('events');
    } catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 4000); }
    finally { setSaving(false); }
  }

  async function rsvp(event: EventItem, going: boolean) {
    if (!user) return;
    const next = new Set(event.attendeeUids || []);
    if (going) next.add(user.uid); else next.delete(user.uid);
    try { await updateDoc(doc(db, 'events', event.id), { attendeeUids: [...next], updatedAt: new Date().toISOString() }); }
    catch (err) { setToast(authError(err)); setTimeout(() => setToast(''), 3500); }
  }

  async function markRead(notice: Notice) {
    try { await updateDoc(doc(db, 'notifications', notice.id), { read: true }); }
    catch (err) { console.error(err); }
  }

  if (!user) return <AuthScreen />;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand sidebar-brand" onClick={() => setTab('home')}><span className="brand-mark">u<span>2</span></span><span>UP2</span></button>
      <div className="sidebar-caption">YOUR CORNER</div>
      <nav className="main-nav">
        <NavButton active={tab === 'home'} icon={<Sparkles size={18} />} label="Your feed" onClick={() => setTab('home')} />
        <NavButton active={tab === 'events'} icon={<CalendarDays size={18} />} label="Plans" onClick={() => setTab('events')} />
        <NavButton active={tab === 'messages'} icon={<MessageCircle size={18} />} label="Messages" count={conversations.filter(c=>c.lastSenderId&&c.lastSenderId!==user.uid).length} onClick={() => setTab('messages')} />
        <NavButton active={tab === 'memories'} icon={<ImagePlus size={18} />} label="Memories" onClick={() => setTab('memories')} />
        <NavButton active={tab === 'invites'} icon={<Bell size={18} />} label="Invitations" count={unread + invitedEvents.length} onClick={() => setTab('invites')} />
        <NavButton active={tab === 'people'} icon={<Users size={18} />} label="Find your people" onClick={() => setTab('people')} />
        <NavButton active={tab === 'profile'} icon={<Users size={18} />} label="Your profile" onClick={() => openProfile(user.uid)} />
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><div className="note-icon"><Heart size={16} /></div><p>Made for real life.</p><span>No algorithm. No rush.</span></div>
        <button className="profile-chip" onClick={() => openProfile(user.uid)}><Avatar name={profile?.displayName || user.displayName || 'You'} photo={profile?.photoURL || user.photoURL || undefined} /><span className="profile-chip-text"><strong>{profile?.displayName || user.displayName || 'Your profile'}</strong><small>View profile</small></span><ArrowUpRight size={16} /></button><button className="logout-button" onClick={() => signOut(auth)}><LogOut size={15} /> Log out</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="mobile-brand brand"><span className="brand-mark">u<span>2</span></span><span>UP2</span></div>
        <div className="topbar-context"><span className="live-dot" /> AOTEAROA, ONLINE</div>
        <div className="topbar-actions"><button className="icon-button" aria-label="Invitations" onClick={() => setTab('invites')}><Bell size={18} />{unread > 0 && <i />}</button><button className="button button-dark button-small" onClick={() => setEventOpen(true)}><Plus size={16} /> Make a plan</button></div>
      </header>

      <div className="content-wrap">
        {tab === 'home' && <section className="page-section">
          <div className="page-heading"><div><span className="eyebrow">YOUR CORNER OF THE WORLD</span><h1>What's <em>up?</em></h1><p>Catch up with your people. Then get out there.</p></div><div className="heading-scribble">less scroll<br />more soul <span>↗</span></div></div>
          <form className="composer card" onSubmit={publishPost}>
            <Avatar name={profile?.displayName || 'You'} photo={profile?.photoURL || undefined} size="large" />
            <div className="composer-main"><textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="What's happening in your world?" maxLength={2000} rows={2} />
              {mediaPreview && <div className="media-preview">{mediaFile?.type.startsWith('video/') ? <video src={mediaPreview} controls /> : <img src={mediaPreview} alt="Selected upload preview" />}<button type="button" className="media-remove" onClick={() => setMediaFile(null)} aria-label="Remove media"><X size={15} /></button></div>}
              <div className="composer-bottom"><div className="composer-tools"><label className="media-pick" title="Add a photo or video"><ImagePlus size={16} /><span>Photo / video</span><input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e => setMediaFile(e.target.files?.[0] || null)} /></label><span className="audience-select"><Users size={14} /> Accepted followers only</span></div><button className="button button-dark button-small" disabled={(!postText.trim() && !mediaFile) || saving}>{uploadingMedia ? 'Uploading…' : 'Share'} <ArrowUpRight size={15} /></button></div>
            </div>
          </form>
          <div className="section-label"><span>THE LATEST</span><span className="section-line" /><span className="muted">{posts.length} posts</span></div>
          {posts.length === 0 ? <EmptyState icon={<MessageCircle size={21} />} title="A little quiet around here." body="Follow a few people or share the first update. Your feed stays in time order, always." action="Find your people" onClick={() => setTab('people')} /> : <div className="post-list">{posts.map(post => <article className="post-card card" id={`post-${post.id}`} key={post.id}><div className="post-head"><Avatar name={post.authorName} photo={post.authorPhoto} /><div className="post-author"><strong>{post.authorName}{post.authorId === user.uid && <span className="you-tag">YOU</span>}</strong><span>{timeAgo(post.createdAt)} · Accepted followers only</span></div><span className="post-dot">· · ·</span></div><p className="post-text">{post.text}</p>{post.mediaUrl && <div className="post-media">{post.mediaType === 'video' ? <video src={post.mediaUrl} controls playsInline preload="metadata" /> : <img src={post.mediaUrl} alt={`Photo shared by ${post.authorName}`} loading="lazy" />}</div>}<div className="post-footer"><button className={'post-action ' + (postLikes[post.id]?.liked ? 'post-action-liked' : '')} onClick={() => void toggleLike(post)} aria-label={postLikes[post.id]?.liked ? 'Unlike post' : 'Like post'}><Heart size={16} fill={postLikes[post.id]?.liked ? 'currentColor' : 'none'} /> <strong>{postLikes[post.id]?.count || 0}</strong> {postLikes[post.id]?.liked ? 'Liked' : 'Like'}</button><button className="post-action" onClick={() => setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}><MessageCircle size={16} /> <strong>{postComments[post.id]?.length || 0}</strong> Comment</button><button className="post-action" onClick={() => void sharePost(post)}><Share2 size={15} /> Share</button></div>{openComments[post.id] && <div className="comments-panel"><div className="comments-list">{(postComments[post.id] || []).map(comment => <div className="comment-row" key={comment.id}><Avatar name={comment.authorName} photo={comment.authorPhoto} size="small" /><div className="comment-bubble"><strong>{comment.authorName}</strong><p>{comment.text}</p><small>{timeAgo(comment.createdAt)}</small></div>{comment.authorId === user.uid && <button className="comment-delete" onClick={() => void deleteComment(post, comment)} aria-label="Delete your comment"><Trash2 size={13} /></button>}</div>)}{(postComments[post.id] || []).length === 0 && <p className="comments-empty">Start the conversation.</p>}</div><form className="comment-form" onSubmit={e => void addComment(post, e)}><input value={commentDrafts[post.id] || ''} onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder="Write a comment…" maxLength={500} aria-label="Write a comment" /><button type="submit" disabled={!(commentDrafts[post.id] || '').trim()} aria-label="Send comment"><Send size={16} /></button></form></div>}</article>)}</div>}
          <div className="caught-up"><span className="caught-icon"><Check size={16} /></span><p><strong>That's you caught up.</strong><br /><span>Go make something happen.</span></p></div>
        </section>}

        {tab === 'events' && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">GOOD THINGS HAPPEN OFFLINE</span><h1>Make <em>plans.</em></h1><p>Find a reason to get everyone in the same place.</p></div><button className="button button-dark" onClick={() => setEventOpen(true)}><Plus size={16} /> Create an event</button></div>
          <div className="event-tabs"><span className="active">Coming up</span><span>Public events</span><span>Your plans</span></div>
          {events.length === 0 ? <EmptyState icon={<CalendarDays size={21} />} title="Nothing on the calendar. Yet." body="Be the person who makes something happen. Invite your friends or put a public plan out there." action="Create an event" onClick={() => setEventOpen(true)} /> : <div className="events-grid">{[...events].sort((a,b) => new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime()).map(event => <EventCard key={event.id} event={event} uid={user.uid} onRsvp={rsvp} />)}</div>}
        </section>}

        {tab === 'messages' && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOUR PEOPLE, IN YOUR POCKET</span><h1>Your <em>messages.</em></h1><p>Private conversations and event group chats in one place.</p></div></div><div className="messenger-layout"><aside className="conversation-list">{conversations.length===0?<div className="conversation-empty"><MessageCircle size={22}/><strong>Start a conversation</strong><p>Find someone you know and message them.</p><button className="button button-outline button-small" onClick={()=>setTab('people')}>Find people</button></div>:conversations.map(c=>{const other=c.members.find(uid=>uid!==user.uid)||user.uid;const name=c.type==='event'?(c.eventTitle||c.title||'Event chat'):(c.memberNames?.[other]||people.find(p=>p.uid===other)?.displayName||'Friend');return <button key={c.id} className={'conversation-row '+(activeConversationId===c.id?'conversation-active':'')} onClick={()=>setActiveConversationId(c.id)}><span className="conversation-avatar">{c.type==='event'?<CalendarDays size={17}/>:initials(name)}</span><span className="conversation-copy"><strong>{name}</strong><small>{c.type==='event'?'Event group chat':'Direct message'}</small><span>{c.lastMessage||'Say hello'}</span></span></button>})}</aside><section className="chat-panel">{!activeConversationId?<div className="chat-placeholder"><MessageCircle size={30}/><h3>Pick a conversation</h3><p>Your event chats and direct messages will appear here.</p></div>:<><div className="chat-head"><div><span className="eyebrow">{conversations.find(c=>c.id===activeConversationId)?.type==='event'?'EVENT CHAT':'DIRECT MESSAGE'}</span><h2>{conversations.find(c=>c.id===activeConversationId)?.eventTitle||conversations.find(c=>c.id===activeConversationId)?.memberNames?.[conversations.find(c=>c.id===activeConversationId)?.members.find(uid=>uid!==user.uid)||'']||'Conversation'}</h2></div></div><div className="chat-message-list">{chatMessages.length===0?<div className="chat-placeholder"><p>This is the beginning. Say something.</p></div>:chatMessages.map(m=><div key={m.id} className={'chat-message '+(m.senderId===user.uid?'chat-message-own':'')}><strong>{m.senderId===user.uid?'You':m.senderName}</strong><p>{m.text}</p><small>{timeAgo(m.createdAt)}</small></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Write a message…" maxLength={2000}/><button type="submit" disabled={!messageDraft.trim()} aria-label="Send message"><Send size={17}/></button></form></>}</section></div></section>}

        {tab === 'memories' && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">THE GOOD STUFF STAYS</span><h1>Your <em>memories.</em></h1><p>Your events, with their conversations and shared photos.</p></div></div><div className="memory-grid">{events.filter(e=>(e.attendeeUids||[]).includes(user.uid)||e.hostId===user.uid).sort((a,b)=>new Date(b.startsAt).getTime()-new Date(a.startsAt).getTime()).map(e=><article className="memory-card card" key={e.id}><div className="memory-cover"><CalendarDays size={26}/><span>{new Date(e.startsAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</span></div><div className="memory-copy"><span className="eyebrow">{new Date(e.startsAt).getTime()<Date.now()?'FROM THE ARCHIVE':'COMING UP'}</span><h3>{e.title}</h3><p>{e.location||'A moment with your people'}</p><div className="album-photos">{(eventPhotos[e.id]||[]).map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="album-photo" aria-label={'Open photo shared by '+photo.authorName}>{photo.mediaType==='video'?<video src={photo.url} muted preload="metadata"/>:<img src={photo.url} alt={'Shared by '+photo.authorName} loading="lazy"/>}</a>)}</div><div className="album-actions"><label className="button button-outline button-small album-upload">{uploadingAlbumFor===e.id?'Uploading…':'Add photos'} <ImagePlus size={14}/><input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" disabled={uploadingAlbumFor===e.id} onChange={event=>{void uploadEventPhoto(e,event.target.files?.[0]);event.currentTarget.value='';}}/></label><button className="button button-outline button-small" onClick={()=>{const c=conversations.find(c=>c.eventId===e.id);if(c){setActiveConversationId(c.id);setTab('messages')}else setToast('Event chat is not available for this event yet.')}}>Open chat <ArrowUpRight size={14}/></button></div></div></article>)}{events.filter(e=>(e.attendeeUids||[]).includes(user.uid)||e.hostId===user.uid).length===0&&<EmptyState icon={<ImagePlus size={21}/>} title="Your story starts here." body="Events you attend will collect here." action="Find a plan" onClick={()=>setTab('events')}/>}</div></section>}

        {tab === 'invites' && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOU'RE ON THE LIST</span><h1>You're <em>invited.</em></h1><p>Good things start with someone thinking of you.</p></div></div>
          {incomingRequests.length > 0 && <><div className="section-label"><span>FOLLOW REQUESTS</span><span className="section-line" /><span className="muted">{incomingRequests.length}</span></div><div className="request-list">{incomingRequests.map(request => <article className="request-row card" key={request.id}><Avatar name={request.requesterName} photo={request.requesterPhoto} /><div className="request-copy"><strong>{request.requesterName}</strong><span>wants to follow you</span></div><button className="button button-dark button-small" onClick={() => void respondToFollowRequest(request, 'accepted')}><Check size={14} /> Accept</button><button className="button button-outline button-small" onClick={() => void respondToFollowRequest(request, 'declined')}>Decline</button></article>)}</div></>}
          {outgoingRequests.length > 0 && <><div className="section-label section-label-spaced"><span>REQUESTS SENT</span><span className="section-line" /></div><div className="request-list">{outgoingRequests.map(request => <article className="request-row card" key={request.id}><Avatar name={people.find(person => person.uid === request.targetId)?.displayName || 'UP2 member'} /><div className="request-copy"><strong>{people.find(person => person.uid === request.targetId)?.displayName || 'UP2 member'}</strong><span>Follow request pending</span></div><button className="button button-outline button-small" onClick={() => void followPerson({ uid: request.targetId, displayName: people.find(person => person.uid === request.targetId)?.displayName || 'UP2 member' })}>Cancel</button></article>)}</div></>}
          <div className="section-label section-label-spaced"><span>EVENT INVITATIONS</span><span className="section-line" /></div>
          {invitedEvents.length === 0 ? <EmptyState icon={<Bell size={21} />} title="No invitations just yet." body="When a friend invites you to something, you'll find it here. You could always be the one to start a plan." action="Make a plan" onClick={() => setEventOpen(true)} /> : <div className="events-grid">{invitedEvents.map(event => <EventCard key={event.id} event={event} uid={user.uid} onRsvp={rsvp} />)}</div>}
          {notices.length > 0 && <><div className="section-label section-label-spaced"><span>NOTIFICATIONS</span><span className="section-line" /></div><div className="notice-list">{notices.map(notice => <button className={'notice-row ' + (!notice.read ? 'notice-unread' : '')} key={notice.id} onClick={() => { void markRead(notice); setTab('events'); }}><span className="notice-icon"><CalendarDays size={17} /></span><span><strong>{notice.actorName} invited you to {notice.eventTitle}</strong><small>{timeAgo(notice.createdAt)}</small></span>{!notice.read && <i />}</button>)}</div></>}
        </section>}

        {tab === 'people' && <section className="page-section"><div className="page-heading"><div><span className="eyebrow">GOOD PEOPLE, GOOD TIMES</span><h1>Find your <em>people.</em></h1><p>Follow the people you know. Their posts will find their way to you.</p></div></div>
          <div className="people-search"><Search size={17} /><input value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} placeholder="Search by name or email" /></div>
          {followedProfiles.length > 0 && <><div className="section-label"><span>YOUR PEOPLE</span><span className="section-line" /><span className="muted">{followedProfiles.length}</span></div><div className="people-grid">{followedProfiles.map(person => <PersonCard key={person.uid} person={person} following onProfile={() => openProfile(person.uid)} onFollow={() => followPerson(person)} onMessage={() => void startConversation(person)} />)}</div></>}
          <div className="section-label section-label-spaced"><span>MEET THE COMMUNITY</span><span className="section-line" /></div>
          {filteredPeople.length === 0 ? <EmptyState icon={<Users size={21} />} title="No one by that name yet." body="Try another search, or invite a friend to join UP2." /> : <div className="people-grid">{filteredPeople.map(person => <PersonCard key={person.uid} person={person} following={followingIds.includes(person.uid)} pending={outgoingRequests.some(request => request.targetId === person.uid)} onProfile={() => openProfile(person.uid)} onFollow={() => followPerson(person)} onMessage={() => void startConversation(person)} />)}</div>}
        </section>}

        {tab === 'profile' && <section className="page-section profile-page">
          {(() => {
            const isOwnProfile = profilePageUid === user.uid;
            const publicProfile = isOwnProfile ? profile : (people.find(person => person.uid === profilePageUid) || null);
            const displayedProfile = isOwnProfile ? profile : (profileDetails || publicProfile);
            const isFollowing = followingIds.includes(profilePageUid);
            const requestPending = outgoingRequests.some(request => request.targetId === profilePageUid);
            return <>
              <div className="profile-page-top"><button className="text-button" onClick={() => setTab('people')}>← Back to people</button><span className="eyebrow">YOUR UP2 PROFILE</span></div>
              <article className="profile-header card">
                <Avatar name={displayedProfile?.displayName || 'UP2 member'} photo={displayedProfile?.photoURL} size="large" />
                <div className="profile-header-main"><h1>{displayedProfile?.displayName || 'UP2 member'}</h1>
                  <div className="profile-stats"><span><strong>{isOwnProfile || profilePageUnlocked ? profilePagePosts.length : '—'}</strong> posts</span><span><strong>{isOwnProfile || profilePageUnlocked ? profileFollowers.length : '—'}</strong> followers</span><span><strong>{isOwnProfile || profilePageUnlocked ? profileFollowing.length : '—'}</strong> following</span></div>
                  {isOwnProfile ? <p className="profile-bio">{profile?.bio || 'Add a little bio so your people know it’s you.'}</p> : profilePageUnlocked ? <p className="profile-bio">{profileDetails?.bio || 'No bio yet.'}</p> : <p className="profile-bio private-copy">🔒 This account is private. Bio and posts are visible only after your follow request is accepted.</p>}
                </div>
                {isOwnProfile ? <span className="private-pill"><span /> PRIVATE ACCOUNT</span> : <div className="profile-actions"><button className={'button button-small ' + (isFollowing ? 'button-outline' : 'button-dark')} onClick={() => { const person = publicProfile || { uid: profilePageUid, displayName: displayedProfile?.displayName || 'UP2 member', photoURL: displayedProfile?.photoURL }; void followPerson(person); }}>{isFollowing ? 'Following · Unfollow' : requestPending ? 'Requested · Cancel' : 'Follow'}</button>{profilePageUnlocked && displayedProfile && <button className="button button-outline button-small" onClick={() => void startConversation(displayedProfile)}><MessageCircle size={14} /> Message</button>}</div>}
              </article>
              {isOwnProfile && <form className="profile-edit card" onSubmit={saveProfile}><div><span className="eyebrow">MAKE IT YOURS</span><h2>Edit profile</h2><p className="muted">Your account is private. Only accepted followers can see your bio and posts.</p></div><label>Display name<input value={profileNameDraft} onChange={e => setProfileNameDraft(e.target.value)} maxLength={60} required /></label><label>Bio <span className="muted">({profileBioDraft.length}/160)</span><textarea value={profileBioDraft} onChange={e => setProfileBioDraft(e.target.value)} maxLength={160} rows={3} placeholder="A little about you…" /></label><button className="button button-dark button-small" disabled={profileSaveBusy}>{profileSaveBusy ? 'Saving…' : 'Save profile'} <Check size={14} /></button></form>}
              {!isOwnProfile && !profilePageUnlocked ? <div className="profile-locked card"><span className="lock-symbol">🔒</span><h2>This account is private</h2><p>Send a follow request. Once it’s accepted, you’ll be able to see their bio, posts, followers and following.</p><button className="button button-dark" onClick={() => { const person = publicProfile || { uid: profilePageUid, displayName: displayedProfile?.displayName || 'UP2 member' }; void followPerson(person); }}>{requestPending ? 'Cancel follow request' : 'Request to follow'}</button></div> : <>
                <div className="profile-section-heading"><span className="eyebrow">POSTS</span><span className="section-line" /><span className="muted">{profilePagePosts.length}</span></div>
                {profilePagePosts.length === 0 ? <EmptyState icon={<ImagePlus size={21} />} title="No posts yet." body={isOwnProfile ? "Your posts will appear here." : "This person hasn't shared anything yet."} /> : <div className="profile-post-grid">{profilePagePosts.map(post => <button className="profile-post-tile" key={post.id} onClick={() => { setTab('home'); setPosts(current => current.some(item => item.id === post.id) ? current : [post, ...current]); setTimeout(() => document.getElementById('post-' + post.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }} aria-label={'Open post by ' + post.authorName}>{post.mediaUrl ? (post.mediaType === 'video' ? <video src={post.mediaUrl} muted preload="metadata" /> : <img src={post.mediaUrl} alt="" loading="lazy" />) : <span>{post.text}</span>}<i><Heart size={14} /> {postLikes[post.id]?.count || 0}</i></button>)}</div>}
                <div className="profile-relations"><section><div className="profile-section-heading"><span className="eyebrow">FOLLOWERS</span><span className="section-line" /><span className="muted">{profileFollowers.length}</span></div>{profileFollowers.length ? profileFollowers.map(person => <button className="relation-row" key={person.uid} onClick={() => openProfile(person.uid)}><Avatar name={person.displayName} photo={person.photoURL} size="small" /><span>{person.displayName}</span><ArrowUpRight size={14} /></button>) : <p className="muted">No followers to show yet.</p>}</section><section><div className="profile-section-heading"><span className="eyebrow">FOLLOWING</span><span className="section-line" /><span className="muted">{profileFollowing.length}</span></div>{profileFollowing.length ? profileFollowing.map(person => <button className="relation-row" key={person.uid} onClick={() => openProfile(person.uid)}><Avatar name={person.displayName} photo={person.photoURL} size="small" /><span>{person.displayName}</span><ArrowUpRight size={14} /></button>) : <p className="muted">Not following anyone yet.</p>}</section></div>
              </>}
            </>;
          })()}
        </section>}
      </div>
      <footer className="site-footer"><span>UP2 © 2026</span><span>YOUR PEOPLE. YOUR PLANS. YOUR LIFE.</span><button onClick={() => setToast('Privacy and community guidelines are being prepared for the beta launch.')}>Community & privacy</button></footer>
    </main>

    <nav className="mobile-nav">
      <NavButton active={tab === 'home'} icon={<Sparkles size={19} />} label="Feed" onClick={() => setTab('home')} />
      <NavButton active={tab === 'events'} icon={<CalendarDays size={19} />} label="Plans" onClick={() => setTab('events')} />
      <NavButton active={tab === 'messages'} icon={<MessageCircle size={19} />} label="Chats" onClick={() => setTab('messages')} />
      <button className="mobile-create" onClick={() => setEventOpen(true)} aria-label="Create event"><Plus size={22} /></button>
      <NavButton active={tab === 'invites'} icon={<Bell size={19} />} label="Invites" count={unread} onClick={() => setTab('invites')} />
      <NavButton active={tab === 'people'} icon={<Users size={19} />} label="People" onClick={() => setTab('people')} />
    </nav>

    {eventOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEventOpen(false); }}><section className="event-modal"><div className="modal-head"><div><span className="eyebrow">GET EVERYONE TOGETHER</span><h2>Make a <em>plan.</em></h2></div><button className="icon-button" onClick={() => setEventOpen(false)} aria-label="Close"><X size={19} /></button></div>
      <form className="stack-form event-form" onSubmit={createEvent}>
        <label>What's happening?<input required maxLength={120} value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Beach, dinner, gig, spontaneous adventure…" /></label>
        <label>Tell people a little more <textarea rows={2} maxLength={1000} value={eventDescription} onChange={e => setEventDescription(e.target.value)} placeholder="The vibe, the details, anything they need to know." /></label>
        <div className="form-two"><label>When?<input required type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} /></label><label>Where?<input maxLength={200} value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="Share with invitees" /></label></div>
        <div className="label-block">WHO'S INVITED?</div>
        <div className="visibility-options"><button type="button" className={'visibility-option ' + (eventVisibility === 'selected' ? 'chosen' : '')} onClick={() => setEventVisibility('selected')}><Users size={17} /><span><strong>Selected friends</strong><small>Just the people you choose</small></span>{eventVisibility === 'selected' && <Check size={16} />}</button><button type="button" className={'visibility-option ' + (eventVisibility === 'public' ? 'chosen' : '')} onClick={() => setEventVisibility('public')}><Compass size={17} /><span><strong>Everyone</strong><small>Discoverable by the UP2 community</small></span>{eventVisibility === 'public' && <Check size={16} />}</button></div>
        {eventVisibility === 'selected' && <div className="invite-picker">{followedProfiles.length === 0 ? <p className="muted small-copy">Follow some friends first, and they'll show up here.</p> : followedProfiles.map(person => <label className="invite-person" key={person.uid}><span><Avatar name={person.displayName} photo={person.photoURL} size="small" />{person.displayName}</span><input type="checkbox" checked={invitees.includes(person.uid)} onChange={e => setInvitees(prev => e.target.checked ? [...prev, person.uid] : prev.filter(id => id !== person.uid))} /></label>)}</div>}
        <button className="button button-dark full-width create-event-button" disabled={saving || !eventTitle.trim() || !eventDate}>{saving ? 'Getting things ready…' : eventVisibility === 'public' ? 'Publish event' : 'Send ' + (invitees.length ? invitees.length + ' invitation' + (invitees.length === 1 ? '' : 's') : 'invitations')} <ArrowUpRight size={16} /></button>
      </form>
    </section></div>}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>;
}

function mergeEvents(current: EventItem[], incoming: EventItem[]) {
  const map = new Map(current.map(e => [e.id, e]));
  incoming.forEach(e => map.set(e.id, e));
  return [...map.values()];
}
function NavButton({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return <button className={'nav-button ' + (active ? 'nav-active' : '')} onClick={onClick}>{icon}<span>{label}</span>{!!count && count > 0 && <b>{count > 9 ? '9+' : count}</b>}</button>;
}
function EmptyState({ icon, title, body, action, onClick }: { icon: React.ReactNode; title: string; body: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{body}</p>{action && <button className="button button-outline" onClick={onClick}>{action} <ArrowUpRight size={15} /></button>}</div>;
}
function PersonCard({ person, following, pending = false, onProfile, onFollow, onMessage }: { person: Profile; following: boolean; pending?: boolean; onProfile: () => void; onFollow: () => void; onMessage: () => void }) {
  return <article className="person-card card"><button className="person-open-profile" onClick={onProfile} aria-label={'View '+person.displayName+' profile'}><Avatar name={person.displayName} photo={person.photoURL} size="large" /></button><button className="person-info person-info-button" onClick={onProfile}><strong>{person.displayName}</strong><span>Private account</span></button><button className="message-person-button" onClick={onMessage} aria-label={'Message '+person.displayName}><MessageCircle size={15}/></button><button className={'follow-button ' + (following ? 'following' : '')} onClick={onFollow}>{following ? <><Check size={14} /> Following</> : pending ? 'Requested' : <><Plus size={14} /> Follow</>}</button></article>;
}
function EventCard({ event, uid, onRsvp }: { event: EventItem; uid: string; onRsvp: (event: EventItem, going: boolean) => void }) {
  const going = (event.attendeeUids || []).includes(uid);
  const invited = (event.invitedUids || []).includes(uid);
  const isHost = event.hostId === uid;
  return <article className="event-card card"><div className="event-card-top"><span className={'event-pill ' + (event.visibility === 'public' ? 'pill-public' : '')}>{event.visibility === 'public' ? <><Compass size={12} /> OPEN TO EVERYONE</> : <><Users size={12} /> INVITATION</>}</span><span className="event-date-icon"><CalendarDays size={18} /></span></div><h3>{event.title}</h3>{event.description && <p className="event-description">{event.description}</p>}<div className="event-meta"><span><Clock3 size={14} />{niceDate(event.startsAt)}</span>{event.location && <span><MapPin size={14} />{event.location}</span>}</div><div className="event-card-footer"><div className="attendee-count"><span className="attendee-avatars"><Avatar name={event.hostName} size="small" /></span><span><strong>{event.attendeeUids?.length || 0}</strong> going · by {isHost ? 'you' : event.hostName}</span></div>{isHost ? <span className="host-tag">YOUR EVENT</span> : <button className={'rsvp-button ' + (going ? 'going' : '')} onClick={() => onRsvp(event, !going)}>{going ? <><Check size={14} /> Going</> : invited ? "I'm in" : 'Count me in'}</button>}</div></article>;
}
