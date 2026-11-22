import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './firebase';
import {
  INITIAL_APPLICATIONS,
  INITIAL_BRANCHES,
  INITIAL_COURIERS,
  INITIAL_NOTIFICATION_PREFS,
  INITIAL_POSTAGE_TRACKINGS,
  INITIAL_ROLES,
  INITIAL_SYSTEM_PREFS,
  INITIAL_USERS,
} from '../data/mockData';
import type {
  Branch,
  Courier,
  InstallmentApplication,
  NotificationPreferences,
  PostageTrackingRecord,
  RoleConfig,
  SaleSubmissionList,
  StaffUser,
  SystemPreferences,
} from '../types/khallegacy';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'khallegacyconstruction@gmail.com';
export const SYSTEM_SETTINGS_DOC_ID = 'default-settings';
export const DIRECTORY_VERSION = 3;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function clampString(val: string | undefined, maxLen: number): string | undefined {
  if (val === undefined) return undefined;
  return val.slice(0, maxLen);
}

function sanitizeApplicationForCloud(app: InstallmentApplication): Record<string, unknown> {
  return {
    ...app,
    caseId: app.caseId.slice(0, 40),
    applicationDate: app.applicationDate.slice(0, 20),
    customerName: app.customerName.slice(0, 150),
    icNumber: app.icNumber.slice(0, 30),
    phone: app.phone.slice(0, 30),
    address: (app.address ?? '').slice(0, 400),
    ref1Id: (app.ref1Id ?? '').slice(0, 64),
    bankName: clampString(app.bankName, 100),
    bankAccountNumber: clampString(app.bankAccountNumber, 60),
    applicationRemarks: clampString(app.applicationRemarks, 500),
    internalNotes: clampString(app.internalNotes, 500),
    approvalRemarks: (app.approvalRemarks ?? '').slice(0, 500),
    category: clampString(app.category, 40),
    products: app.products.slice(0, 20),
    documents: app.documents.slice(0, 30),
    timeline: app.timeline.slice(0, 100),
  };
}

type DocMeta = {
  ownerUid: string;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
};

const docMetaCache = new Map<string, DocMeta>();

function cacheDocMeta(colName: string, id: string, data: DocumentData) {
  if (typeof data.ownerUid === 'string' && data.createdAt) {
    docMetaCache.set(`${colName}/${id}`, {
      ownerUid: data.ownerUid,
      createdAt: data.createdAt as Timestamp,
    });
  }
}

function buildCollectionQuery(colName: string, user: FirebaseUser): Query<DocumentData> {
  if (isBootstrappedAdminEmail(user.email)) {
    return collection(db, colName);
  }
  return query(collection(db, colName), where('ownerUid', '==', user.uid));
}

export async function ensureUserProfile(
  user: FirebaseUser,
  matchedStaff?: StaffUser,
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');
  const displayName =
    (matchedStaff?.name || user.displayName || user.email?.split('@')[0] || 'Staff Operator').slice(
      0,
      120,
    );
  const roleId = isBootstrappedAdminEmail(user.email)
    ? 'role-manager'
    : matchedStaff?.roleId || 'role-sales-admin';

  try {
    const existingPublic = await getDoc(userRef);
    if (!existingPublic.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        roleId,
        ...(matchedStaff?.id ? { staffUserId: matchedStaff.id } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prev = existingPublic.data();
      await setDoc(userRef, {
        uid: prev.uid,
        displayName,
        roleId: prev.roleId,
        ...(prev.staffUserId ? { staffUserId: prev.staffUserId } : {}),
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const existingPrivate = await getDoc(privateRef);
    const email = (user.email || '').slice(0, 160);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid: user.uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prev = existingPrivate.data();
      await setDoc(privateRef, {
        uid: prev.uid,
        email,
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

function toCloudStaffRecord(u: StaffUser): Omit<StaffUser, 'password'> {
  const { password: _ignored, ...rest } = u;
  void _ignored;
  return rest;
}

function toCloudSaleSubmission(sub: SaleSubmissionList) {
  const { createdAt: createdAtIso, ...rest } = sub;
  return {
    ...rest,
    createdAtIso,
  };
}

function fromCloudSaleSubmission(data: DocumentData): SaleSubmissionList {
  return {
    id: data.id,
    submissionListId: data.submissionListId,
    submissionDate: data.submissionDate,
    createdAt: data.createdAtIso || data.submissionDate,
    createdBy: data.createdBy,
    agreementIds: Array.isArray(data.agreementIds) ? data.agreementIds : [],
    agreementCount: Number(data.agreementCount ?? 0),
    totalProductAmount: Number(data.totalProductAmount ?? 0),
    totalFinanceAmount: Number(data.totalFinanceAmount ?? 0),
    totalActualCashPayment: Number(data.totalActualCashPayment ?? 0),
    remarks: data.remarks ?? '',
  };
}

function toCloudPostageRecord(rec: PostageTrackingRecord) {
  const { updatedAt: updatedAtIso, ...rest } = rec;
  return {
    ...rest,
    updatedAtIso,
  };
}

function fromCloudPostageRecord(data: DocumentData): PostageTrackingRecord {
  return {
    id: data.id,
    date: data.date,
    description: data.description ?? '',
    saleSubmissionId: data.saleSubmissionId ?? null,
    trackingNumber: data.trackingNumber,
    courier: data.courier,
    status: data.status,
    remarks: data.remarks,
    updatedAt: data.updatedAtIso || data.date,
    updatedBy: data.updatedBy,
  };
}

async function seedCollectionInBatches<T extends { id: string }>(
  colName: string,
  records: T[],
  uid: string,
  idPrefix: string,
  mapper: (r: T) => Record<string, unknown>,
) {
  const CHUNK = 40;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const item of slice) {
      const docId = `${idPrefix}${item.id}`.slice(0, 64);
      const ref = doc(db, colName, docId);
      batch.set(
        ref,
        stripUndefinedDeep({
          ...mapper(item),
          id: docId,
          ownerUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, colName);
    }
  }
}

function resolveSettingsDocId(uid: string, email?: string | null): string {
  return isBootstrappedAdminEmail(email) ? SYSTEM_SETTINGS_DOC_ID : `settings-${uid}`;
}

export async function seedInitialWorkspaceIfEmpty(user: FirebaseUser): Promise<void> {
  const uid = user.uid;
  const adminUser = isBootstrappedAdminEmail(user.email);
  const idPrefix = adminUser ? '' : `${uid.slice(0, 8)}-`;
  const prefixId = (id: string) => (idPrefix ? `${idPrefix}${id}`.slice(0, 64) : id);
  const settingsDocId = resolveSettingsDocId(uid, user.email);

  let workspaceAlreadyInitialized = false;
  let existingSettingsData: DocumentData | null = null;
  let existingSettingsDocRefId = settingsDocId;
  try {
    const settingsSnap = await getDocs(buildCollectionQuery('system_settings', user));
    if (!settingsSnap.empty) {
      workspaceAlreadyInitialized = true;
      existingSettingsData = settingsSnap.docs[0].data();
      existingSettingsDocRefId = settingsSnap.docs[0].id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'system_settings');
  }

  const checkAndSeed = async <T extends { id: string }>(
    colName: string,
    items: T[],
    mapper: (item: T) => Record<string, unknown>,
  ) => {
    try {
      const snap = await getDocs(buildCollectionQuery(colName, user));
      if (snap.empty) {
        await seedCollectionInBatches(colName, items, uid, idPrefix, mapper);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, colName);
    }
  };

  const replaceCollectionWithSeeds = async <T extends { id: string }>(
    colName: string,
    items: T[],
    mapper: (item: T) => Record<string, unknown>,
  ) => {
    try {
      const snap = await getDocs(buildCollectionQuery(colName, user));
      const CHUNK = 300;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const slice = snap.docs.slice(i, i + CHUNK);
        for (const d of slice) {
          batch.delete(d.ref);
          docMetaCache.delete(`${colName}/${d.id}`);
        }
        await batch.commit();
      }
      await seedCollectionInBatches(colName, items, uid, idPrefix, mapper);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, colName);
    }
  };

  const prevDirectoryVersion = Number(existingSettingsData?.systemPrefs?.directoryVersion ?? 0);
  const needsDirectoryV2Migration = workspaceAlreadyInitialized && prevDirectoryVersion < 2;
  const needsRoleSwapV3Migration = workspaceAlreadyInitialized && prevDirectoryVersion < 3;

  if (needsDirectoryV2Migration) {
    await replaceCollectionWithSeeds('branches', INITIAL_BRANCHES, (b) => ({ ...b }));
    await replaceCollectionWithSeeds('staff_users', INITIAL_USERS, (u) => ({
      ...toCloudStaffRecord(u),
      branchId: prefixId(u.branchId),
      roleId: prefixId(u.roleId),
    }));
  } else {
    await checkAndSeed('branches', INITIAL_BRANCHES, (b) => ({ ...b }));
    await checkAndSeed('staff_users', INITIAL_USERS, (u) => ({
      ...toCloudStaffRecord(u),
      branchId: prefixId(u.branchId),
      roleId: prefixId(u.roleId),
    }));
  }

  await checkAndSeed('couriers', INITIAL_COURIERS, (c) => ({ ...c }));
  await checkAndSeed('roles', INITIAL_ROLES, (r) => ({ ...r }));

  if (needsRoleSwapV3Migration) {
    try {
      const rolesSnap = await getDocs(buildCollectionQuery('roles', user));
      for (const roleDoc of rolesSnap.docs) {
        const data = roleDoc.data();
        const roleId = typeof data.id === 'string' ? data.id : roleDoc.id;
        let nextName: string | null = null;
        let nextDesc: string | null = null;
        if (roleId === 'role-manager' || roleId.endsWith('-role-manager')) {
          nextName = 'Management';
          nextDesc = INITIAL_ROLES[0].description;
        } else if (roleId === 'role-management' || roleId.endsWith('-role-management')) {
          nextName = 'Manager';
          nextDesc = INITIAL_ROLES[1].description;
        }
        if (nextName && data.name !== nextName) {
          cacheDocMeta('roles', roleDoc.id, data);
          await setDoc(
            roleDoc.ref,
            stripUndefinedDeep({
              id: roleId,
              name: nextName,
              description: nextDesc ?? data.description ?? '',
              active: Boolean(data.active),
              permissions: Array.isArray(data.permissions) ? data.permissions : [],
              ownerUid: data.ownerUid ?? uid,
              createdAt: data.createdAt ?? serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'roles');
    }
  }

  if (needsDirectoryV2Migration || needsRoleSwapV3Migration) {
    try {
      const updatedSystemPrefs = {
        ...INITIAL_SYSTEM_PREFS,
        ...(existingSettingsData?.systemPrefs ?? {}),
        directoryVersion: DIRECTORY_VERSION,
      };
      await setDoc(
        doc(db, 'system_settings', existingSettingsDocRefId),
        stripUndefinedDeep({
          id: existingSettingsDocRefId,
          notifications: existingSettingsData?.notifications ?? INITIAL_NOTIFICATION_PREFS,
          systemPrefs: updatedSystemPrefs,
          ownerUid: existingSettingsData?.ownerUid ?? uid,
          createdAt: existingSettingsData?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `system_settings/${existingSettingsDocRefId}`,
      );
    }
  }

  if (!workspaceAlreadyInitialized) {
    await checkAndSeed('applications', INITIAL_APPLICATIONS, (a) =>
      sanitizeApplicationForCloud({
        ...a,
        customerFromBranchId: prefixId(a.customerFromBranchId),
        pickupBranchId:
          a.pickupBranchId && a.pickupBranchId !== 'POSTAGE' && a.pickupBranchId !== 'WEB'
            ? prefixId(a.pickupBranchId)
            : a.pickupBranchId,
        staffInChargeId: prefixId(a.staffInChargeId),
      }),
    );
    await checkAndSeed('postage_trackings', INITIAL_POSTAGE_TRACKINGS, (p) =>
      toCloudPostageRecord(p),
    );

    try {
      await setDoc(doc(db, 'system_settings', settingsDocId), {
        id: settingsDocId,
        notifications: INITIAL_NOTIFICATION_PREFS,
        systemPrefs: {
          ...INITIAL_SYSTEM_PREFS,
          directoryVersion: DIRECTORY_VERSION,
        },
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `system_settings/${settingsDocId}`);
    }
  }
}

export interface WorkspaceCallbacks {
  onBranches: (items: Branch[]) => void;
  onCouriers: (items: Courier[]) => void;
  onRoles: (items: RoleConfig[]) => void;
  onStaffUsers: (items: StaffUser[]) => void;
  onApplications: (items: InstallmentApplication[]) => void;
  onSaleSubmissions: (items: SaleSubmissionList[]) => void;
  onPostageTrackings: (items: PostageTrackingRecord[]) => void;
  onSettings: (notifications: NotificationPreferences, systemPrefs: SystemPreferences) => void;
}

export function subscribeWorkspaceCollections(
  user: FirebaseUser,
  callbacks: WorkspaceCallbacks,
  onSyncError?: (error: Error) => void,
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const handleSnapshotError = (colName: string) => (err: unknown) => {
    try {
      handleFirestoreError(err, OperationType.GET, colName);
    } catch (wrapped) {
      if (onSyncError && wrapped instanceof Error) {
        onSyncError(wrapped);
      }
    }
  };

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('branches', user),
      (snap) => {
        const items: Branch[] = snap.docs.map((d) => {
          const data = d.data();
          cacheDocMeta('branches', d.id, data);
          return {
            id: data.id,
            code: data.code,
            name: data.name,
            state: data.state,
            active: Boolean(data.active),
          };
        });
        callbacks.onBranches(items);
      },
      handleSnapshotError('branches'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('couriers', user),
      (snap) => {
        const items: Courier[] = snap.docs.map((d) => {
          const data = d.data();
          cacheDocMeta('couriers', d.id, data);
          return {
            id: data.id,
            code: data.code,
            name: data.name,
            active: Boolean(data.active),
            trackingUrl: data.trackingUrl,
          };
        });
        if (items.length > 0) callbacks.onCouriers(items);
      },
      handleSnapshotError('couriers'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('roles', user),
      (snap) => {
        const items: RoleConfig[] = snap.docs.map((d) => {
          const data = d.data();
          cacheDocMeta('roles', d.id, data);
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            active: Boolean(data.active),
            permissions: Array.isArray(data.permissions) ? data.permissions : [],
          };
        });
        const roleOrder = (id: string) => {
          if (id === 'role-manager' || id.endsWith('-role-manager')) return 0;
          if (id === 'role-management' || id.endsWith('-role-management')) return 1;
          if (id === 'role-sales-admin' || id.endsWith('-role-sales-admin')) return 2;
          return 3;
        };
        items.sort((a, b) => roleOrder(a.id) - roleOrder(b.id) || a.name.localeCompare(b.name));
        if (items.length > 0) callbacks.onRoles(items);
      },
      handleSnapshotError('roles'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('staff_users', user),
      (snap) => {
        const items: StaffUser[] = snap.docs.map((d) => {
          const data = d.data();
          cacheDocMeta('staff_users', d.id, data);
          return {
            id: data.id,
            name: data.name,
            username: data.username,
            email: data.email,
            branchId: data.branchId,
            roleId: data.roleId,
            status: data.status,
            lastActive: data.lastActive,
          };
        });
        callbacks.onStaffUsers(items);
      },
      handleSnapshotError('staff_users'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('applications', user),
      (snap) => {
        const items: InstallmentApplication[] = snap.docs
          .map((d) => {
            const data = d.data();
            cacheDocMeta('applications', d.id, data);
            const { ownerUid: _o, createdAt: _c, updatedAt: _u, ...appFields } = data;
            void _o;
            void _c;
            void _u;
            return appFields as InstallmentApplication;
          })
          .sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
        callbacks.onApplications(items);
      },
      handleSnapshotError('applications'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('sale_submissions', user),
      (snap) => {
        const items = snap.docs
          .map((d) => {
            const data = d.data();
            cacheDocMeta('sale_submissions', d.id, data);
            return fromCloudSaleSubmission(data);
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onSaleSubmissions(items);
      },
      handleSnapshotError('sale_submissions'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('postage_trackings', user),
      (snap) => {
        const items = snap.docs
          .map((d) => {
            const data = d.data();
            cacheDocMeta('postage_trackings', d.id, data);
            return fromCloudPostageRecord(data);
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        callbacks.onPostageTrackings(items);
      },
      handleSnapshotError('postage_trackings'),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      buildCollectionQuery('system_settings', user),
      (snap) => {
        const first = snap.docs[0];
        if (first) {
          const data = first.data();
          cacheDocMeta('system_settings', first.id, data);
          if (data.notifications && data.systemPrefs) {
            callbacks.onSettings(
              data.notifications as NotificationPreferences,
              data.systemPrefs as SystemPreferences,
            );
          }
        }
      },
      handleSnapshotError('system_settings'),
    ),
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

async function upsertDocWithMeta(
  colName: string,
  id: string,
  payload: Record<string, unknown>,
  uid: string,
): Promise<void> {
  const path = `${colName}/${id}`;
  const ref = doc(db, colName, id);
  try {
    let meta = docMetaCache.get(path);
    if (!meta) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.ownerUid === 'string' && data.createdAt) {
          meta = {
            ownerUid: data.ownerUid,
            createdAt: data.createdAt as Timestamp,
          };
          docMetaCache.set(path, meta);
        }
      }
    }

    const docBody = stripUndefinedDeep({
      ...payload,
      ownerUid: meta ? meta.ownerUid : uid,
      createdAt: meta ? meta.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(ref, docBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveApplicationToCloud(
  app: InstallmentApplication,
  uid: string,
): Promise<void> {
  await upsertDocWithMeta('applications', app.id, sanitizeApplicationForCloud(app), uid);
}

export async function deleteApplicationFromCloud(appId: string): Promise<void> {
  const path = `applications/${appId}`;
  try {
    await deleteDoc(doc(db, 'applications', appId));
    docMetaCache.delete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBranchToCloud(branch: Branch, uid: string): Promise<void> {
  await upsertDocWithMeta('branches', branch.id, { ...branch }, uid);
}

export async function deleteBranchFromCloud(branchId: string): Promise<void> {
  const path = `branches/${branchId}`;
  try {
    await deleteDoc(doc(db, 'branches', branchId));
    docMetaCache.delete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCourierToCloud(courier: Courier, uid: string): Promise<void> {
  await upsertDocWithMeta('couriers', courier.id, { ...courier }, uid);
}

export async function saveRoleToCloud(role: RoleConfig, uid: string): Promise<void> {
  await upsertDocWithMeta('roles', role.id, { ...role }, uid);
}

export async function saveStaffUserToCloud(staff: StaffUser, uid: string): Promise<void> {
  await upsertDocWithMeta('staff_users', staff.id, { ...toCloudStaffRecord(staff) }, uid);
}

export async function deleteStaffUserFromCloud(staffId: string): Promise<void> {
  const path = `staff_users/${staffId}`;
  try {
    await deleteDoc(doc(db, 'staff_users', staffId));
    docMetaCache.delete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSaleSubmissionToCloud(
  submission: SaleSubmissionList,
  uid: string,
): Promise<void> {
  await upsertDocWithMeta(
    'sale_submissions',
    submission.id,
    toCloudSaleSubmission(submission),
    uid,
  );
}

export async function savePostageTrackingToCloud(
  tracking: PostageTrackingRecord,
  uid: string,
): Promise<void> {
  await upsertDocWithMeta(
    'postage_trackings',
    tracking.id,
    toCloudPostageRecord(tracking),
    uid,
  );
}

export async function saveSettingsToCloud(
  notifications: NotificationPreferences,
  systemPrefs: SystemPreferences,
  uid: string,
): Promise<void> {
  const settingsDocId = resolveSettingsDocId(uid, auth.currentUser?.email);
  await upsertDocWithMeta(
    'system_settings',
    settingsDocId,
    {
      id: settingsDocId,
      notifications,
      systemPrefs: {
        ...systemPrefs,
        directoryVersion: DIRECTORY_VERSION,
      },
    },
    uid,
  );
}

export async function clearAllOperationalDataFromCloud(user: FirebaseUser): Promise<void> {
  const collectionsToClear = ['applications', 'sale_submissions', 'postage_trackings'] as const;
  const CHUNK = 300;

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(buildCollectionQuery(colName, user));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const slice = docs.slice(i, i + CHUNK);
        for (const d of slice) {
          batch.delete(d.ref);
          docMetaCache.delete(`${colName}/${d.id}`);
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }
}
