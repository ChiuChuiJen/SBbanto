import React, { useState, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus,
  Store, 
  Utensils, 
  Calendar, 
  Clock, 
  User, 
  ChevronRight, 
  Settings, 
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Edit2,
  LogIn,
  LogOut,
  Globe,
  X,
  Smartphone,
  ShieldCheck,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { format, isAfter, parseISO, addDays, addHours } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Firebase
import { 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  updatePassword,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, secondaryAuth } from './firebase';
import { APP_VERSION, APP_UPDATE_DATE, VERSION_HISTORY } from './constants';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Store {
  id: string;
  name: string;
  description: string;
}

interface Dish {
  id: string;
  storeId: string;
  name: string;
  price: number;
  category?: string;
}

interface Plan {
  id: string;
  name: string;
  storeId: string;
  diningDate: string;
  closingTime: string;
  isClosed?: boolean;
}

interface Order {
  id: string;
  planId: string;
  dishId: string;
  userName: string;
  uid?: string;
  quantity: number;
  isPaid?: boolean;
  timestamp: string;
}

interface Announcement {
  id: string;
  content: string;
  isActive: boolean;
  updatedAt?: string;
}

interface TgSettings {
  botToken: string;
  chatId: string;
  notifyNewPlan: boolean;
  notifyNewOrder: boolean;
  notifyPlanClose: boolean;
  notifyReport: boolean;
}

interface LineSettings {
  channelAccessToken: string;
  userId: string;
  notifyNewPlan: boolean;
  notifyNewOrder: boolean;
  notifyPlanClose: boolean;
  notifyReport: boolean;
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  disabled,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-500/20',
    secondary: 'bg-zinc-900 text-white hover:bg-black -zinc-100 -zinc-900 -white shadow-md shadow-zinc-900/10',
    outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 -zinc-800 -zinc-300 -zinc-800/50',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-5 py-2.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 text-sm',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = 'text',
  className,
  disabled
}: { 
  label?: string; 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && <label className="text-sm font-semibold text-zinc-600 -zinc-400 ml-1">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "px-4 py-2.5 rounded-xl border border-zinc-200 bg-white -zinc-900 -zinc-800 -white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-zinc-400",
        disabled && "opacity-50 cursor-not-allowed bg-zinc-100"
      )}
    />
  </div>
);

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div {...props} className={cn("bg-white -zinc-900/50 rounded-2xl border border-zinc-100 -zinc-800 shadow-sm overflow-hidden transition-all", className)}>
    {children}
  </div>
);

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'guest',
      email: auth.currentUser?.email || 'guest',
      emailVerified: auth.currentUser?.emailVerified || false,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Show a user-friendly alert if it's a permission error
  if (errInfo.error.includes('permission')) {
    const userMsg = auth.currentUser 
      ? `權限不足：您目前的帳號 (${auth.currentUser.email}) 沒有執行此操作的權限。`
      : `權限不足：請先確認您的操作權限。`;
    alert(userMsg);
  }
}

// --- Error Boundary ---
class ErrorBoundary extends Component<any, any> {
  state: any;
  props: any;
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold text-zinc-900">發生錯誤</h1>
            <p className="text-zinc-600 text-sm">{this.state.error?.message || '未知錯誤'}</p>
            <Button onClick={() => window.location.reload()}>重新整理</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App ---

interface AdminUser {
  id: string;
  email: string;
  password?: string;
  role: 'sub-admin';
  permissions: {
    plans: boolean;
    stores: boolean;
    dishes: boolean;
    orders: boolean;
    announcement: boolean;
  };
}

function AppContent() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [language, setLanguage] = useState<'zh' | 'en' | 'vi'>('zh');

  // Translations
  const translations = {
    zh: {
      title: "假日就是要吃便當",
      adminBackend: "管理後台",
      backToFront: "回到前台",
      login: "登入",
      logout: "登出",
      loading: "載入中...",
      plans: "團購方案",
      orders: "訂單明細",
      activePlans: "進行中的團購",
      selectPlan: "選擇一個方案開始訂購",
      noActivePlans: "目前沒有進行中的團購",
      backToList: "返回列表",
      step1: "輸入姓名或代號",
      step2: "選擇菜色",
      step3: "數量",
      confirmOrder: "確認訂購",
      confirmEdit: "確認修改",
      orderSuccess: "訂購成功！",
      editSuccess: "修改成功！",
      myOrder: "我的",
      paid: "已付款",
      unpaid: "未付款",
      noOrders: "目前尚無人訂購",
      allOrders: "全部訂單",
      adminTitle: "管理後台",
      adminDesc: "管理店家、菜色與團購方案",
      tabPlans: "方案",
      tabStores: "店家",
      tabDishes: "菜色",
      tabOrders: "訂單",
      tabAnnounce: "公告",
      addPlan: "新增方案",
      addStore: "新增店家",
      addDish: "新增單筆菜色",
      updateDish: "更新菜色",
      batchAdd: "批次新增",
      edit: "修改",
      delete: "刪除",
      category: "分類",
      price: "價格",
      dishName: "菜色名稱",
      store: "店家",
      diningDate: "用餐日期",
      closingTime: "截止時間",
      planName: "方案名稱",
      storeName: "店家名稱",
      storeDesc: "店家描述",
      announcement: "公告內容",
      save: "儲存",
      cancel: "取消",
    },
    en: {
      title: "Holiday Bento",
      adminBackend: "Admin",
      backToFront: "Client",
      login: "Login",
      logout: "Logout",
      loading: "Loading...",
      plans: "Plans",
      orders: "Orders",
      activePlans: "Active Group Buys",
      selectPlan: "Select a plan to start ordering",
      noActivePlans: "No active group buys at the moment",
      backToList: "Back to List",
      step1: "Enter Name or ID",
      step2: "Choose Dish",
      step3: "Quantity",
      confirmOrder: "Confirm Order",
      confirmEdit: "Confirm Edit",
      orderSuccess: "Order Successful!",
      editSuccess: "Edit Successful!",
      myOrder: "Mine",
      paid: "Paid",
      unpaid: "Unpaid",
      noOrders: "No orders yet",
      allOrders: "All Orders",
      adminTitle: "Admin Dashboard",
      adminDesc: "Manage stores, dishes, and plans",
      tabPlans: "Plans",
      tabStores: "Stores",
      tabDishes: "Dishes",
      tabOrders: "Orders",
      tabAnnounce: "Announce",
      addPlan: "Add Plan",
      addStore: "Add Store",
      addDish: "Add Dish",
      updateDish: "Update Dish",
      batchAdd: "Batch Add",
      edit: "Edit",
      delete: "Delete",
      category: "Category",
      price: "Price",
      dishName: "Dish Name",
      store: "Store",
      diningDate: "Dining Date",
      closingTime: "Closing Time",
      planName: "Plan Name",
      storeName: "Store Name",
      storeDesc: "Store Description",
      announcement: "Announcement",
      save: "Save",
      cancel: "Cancel",
    },
    vi: {
      title: "Cơm Hộp Ngày Lễ",
      adminBackend: "Quản trị",
      backToFront: "Trang chủ",
      login: "Đăng nhập",
      logout: "Đăng xuất",
      loading: "Đang tải...",
      plans: "Kế hoạch",
      orders: "Đơn hàng",
      activePlans: "Đang diễn ra",
      selectPlan: "Chọn một kế hoạch để bắt đầu đặt hàng",
      noActivePlans: "Hiện không có kế hoạch nào",
      backToList: "Quay lại danh sách",
      step1: "Nhập tên hoặc ID",
      step2: "Chọn món",
      step3: "Số lượng",
      confirmOrder: "Xác nhận đặt hàng",
      confirmEdit: "Xác nhận sửa",
      orderSuccess: "Đặt hàng thành công!",
      editSuccess: "Sửa thành công!",
      myOrder: "Của tôi",
      paid: "Đã thanh toán",
      unpaid: "Chưa thanh toán",
      noOrders: "Chưa có đơn hàng nào",
      allOrders: "Tất cả đơn hàng",
      adminTitle: "Bảng điều khiển quản trị",
      adminDesc: "Quản lý cửa hàng, món ăn và kế hoạch",
      tabPlans: "Kế hoạch",
      tabStores: "Cửa hàng",
      tabDishes: "Món ăn",
      tabOrders: "Đơn hàng",
      tabAnnounce: "Thông báo",
      addPlan: "Thêm kế hoạch",
      addStore: "Thêm cửa hàng",
      addDish: "Thêm món",
      updateDish: "Cập nhật món",
      batchAdd: "Thêm hàng loạt",
      edit: "Sửa",
      delete: "Xóa",
      category: "Phân loại",
      price: "Giá",
      dishName: "Tên món",
      store: "Cửa hàng",
      diningDate: "Ngày ăn",
      closingTime: "Thời gian đóng",
      planName: "Tên kế hoạch",
      storeName: "Tên cửa hàng",
      storeDesc: "Mô tả cửa hàng",
      announcement: "Thông báo",
      save: "Lưu",
      cancel: "Hủy",
    }
  };

  const t = (key: keyof typeof translations['zh']) => {
    return translations[language][key] || translations['zh'][key];
  };

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [tgSettings, setTgSettings] = useState<TgSettings>({
    botToken: '',
    chatId: '',
    notifyNewPlan: false,
    notifyNewOrder: false,
    notifyPlanClose: false,
    notifyReport: false
  });
  const [lineSettings, setLineSettings] = useState<LineSettings>({
    channelAccessToken: '',
    userId: '',
    notifyNewPlan: false,
    notifyNewOrder: false,
    notifyPlanClose: false,
    notifyReport: false
  });
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ col: string, id: string } | null>(null);

  // User State
  const [userTab, setUserTab] = useState<'plans' | 'all-orders'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedAllOrdersPlanId, setSelectedAllOrdersPlanId] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [userName, setUserName] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Admin State
  const [adminTab, setAdminTab] = useState<'plans' | 'stores' | 'dishes' | 'orders' | 'announcement' | 'permissions'>('plans');
  const [adminSelectedPlanId, setAdminSelectedPlanId] = useState<string | null>(null);
  const [adminSelectedDishStoreId, setAdminSelectedDishStoreId] = useState<string | null>(null);
  const [newStore, setNewStore] = useState({ name: '', description: '' });
  const [newAdminUser, setNewAdminUser] = useState({ email: '', password: '', permissions: { plans: false, stores: false, dishes: false, orders: false, announcement: false } });
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [newDish, setNewDish] = useState({ storeId: '', name: '', price: '', category: '' });
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ 
    title: string, 
    message: string, 
    onConfirm: () => void 
  } | null>(null);
  const [bulkDishInput, setBulkDishInput] = useState('');
  const [newPlan, setNewPlan] = useState({ name: '', storeId: '', diningDate: '', closingTime: '' });
  const [announcementEdit, setAnnouncementEdit] = useState({ content: '', isActive: false });
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportPlanId, setReportPlanId] = useState<string | null>(null);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [summaryTab, setSummaryTab] = useState<string | null>(null);

  // Admin Order Management (Add / Edit for active or closed plans)
  const [showAdminOrderModal, setShowAdminOrderModal] = useState(false);
  const [adminEditingOrder, setAdminEditingOrder] = useState<Order | null>(null);
  const [adminOrderPlanId, setAdminOrderPlanId] = useState<string>('');
  const [adminOrderUserName, setAdminOrderUserName] = useState('');
  const [adminOrderDishId, setAdminOrderDishId] = useState('');
  const [adminOrderQuantity, setAdminOrderQuantity] = useState<number>(1);
  const [adminOrderIsPaid, setAdminOrderIsPaid] = useState<boolean>(false);
  const [adminOrderSearchDish, setAdminOrderSearchDish] = useState('');
  const [adminOrderNotify, setAdminOrderNotify] = useState(false);
  const [adminOrderSaving, setAdminOrderSaving] = useState(false);

  // Clipboard & Summary Modal copy states
  const [copiedSummaryKey, setCopiedSummaryKey] = useState<string | null>(null);
  const [fallbackCopyText, setFallbackCopyText] = useState<string | null>(null);

  const isSuperAdmin = user?.email?.toLowerCase() === 'chiuchuijen@gmail.com';
  const isAdmin = isSuperAdmin || adminUsers.some(u => u.email.toLowerCase() === user?.email?.toLowerCase());

  const hasPermission = (perm: keyof AdminUser['permissions']) => {
    if (isSuperAdmin) return true;
    const adminUser = adminUsers.find(u => u.email.toLowerCase() === user?.email?.toLowerCase());
    return adminUser?.permissions[perm] === true;
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setUserName(currentUser.displayName || '');
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Store)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'stores'));

    const unsubDishes = onSnapshot(collection(db, 'dishes'), (snapshot) => {
      setDishes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Dish)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dishes'));

    const unsubPlans = onSnapshot(collection(db, 'plans'), (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'plans'));

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const unsubAnnounce = onSnapshot(doc(db, 'announcements', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Announcement;
        setAnnouncement(data);
        setAnnouncementEdit({ content: data.content, isActive: data.isActive });
        if (data.isActive) {
          setShowAnnouncement(true);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'announcements'));

    const unsubTgSettings = onSnapshot(doc(db, 'settings', 'telegram'), (snapshot) => {
      if (snapshot.exists()) {
        setTgSettings(snapshot.data() as TgSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings'));

    const unsubLineSettings = onSnapshot(doc(db, 'settings', 'line'), (snapshot) => {
      if (snapshot.exists()) {
        setLineSettings(snapshot.data() as LineSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings'));

    let unsubAdminUsers = () => {};
    if (isSuperAdmin) {
      unsubAdminUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAdminUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AdminUser)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    } else if (user) {
      unsubAdminUsers = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          setAdminUsers([{ ...snapshot.data(), id: snapshot.id } as AdminUser]);
        } else {
          setAdminUsers([]);
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    }

    return () => {
      unsubStores();
      unsubDishes();
      unsubPlans();
      unsubOrders();
      unsubAnnounce();
      unsubTgSettings();
      unsubLineSettings();
      unsubAdminUsers();
    };
  }, [user, isSuperAdmin]);

  // Auto-close plans when time is reached (Admin only)
  useEffect(() => {
    if (!plans.length || !user) return;
    const isAdmin = isSuperAdmin || adminUsers.some(a => a.id === user.uid);
    if (!isAdmin) return;

    const interval = setInterval(async () => {
      const now = new Date();
      for (const plan of plans) {
        if (!plan.isClosed && plan.closingTime && isAfter(now, parseISO(plan.closingTime))) {
          try {
            await setDoc(doc(db, 'plans', plan.id), { ...plan, isClosed: true }, { merge: true });
            console.log(`Auto-closed plan: ${plan.name}`);
            if (tgSettings.notifyPlanClose || lineSettings.notifyPlanClose) {
              await sendPlanCloseNotification(plan.id, false);
            }
          } catch (e) {
            console.error('Auto close plan failed:', e);
          }
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [plans, tgSettings, lineSettings, user, isSuperAdmin, adminUsers]);

  // Cleanup old plans: Dining Date + 1 day at 20:00
  useEffect(() => {
    if (!plans.length || !isSuperAdmin) return;

    const cleanup = async () => {
      const now = new Date();
      const oldPlans = plans.filter(plan => {
        try {
          const diningDate = parseISO(plan.diningDate);
          // Dining Date + 1 day at 20:00
          const removalTime = addHours(addDays(diningDate, 1), 20);
          return isAfter(now, removalTime);
        } catch (e) {
          return false;
        }
      });

      for (const plan of oldPlans) {
        try {
          await deleteDoc(doc(db, 'plans', plan.id));
          // Also delete associated orders
          const planOrders = orders.filter(o => o.planId === plan.id);
          for (const order of planOrders) {
            await deleteDoc(doc(db, 'orders', order.id));
          }
          console.log(`Auto-removed expired plan: ${plan.name}`);
        } catch (error) {
          console.error(`Error removing old plan ${plan.id}:`, error);
        }
      }
    };

    cleanup();
  }, [plans, orders, isSuperAdmin]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoginError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();
      if (email === 'chiuchuijen@gmail.com') {
        setShowLoginModal(false);
        return;
      }
      
      const userDoc = await getDocFromServer(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        setLoginError("登入錯誤 無使用權限 請聯繫管理員");
      } else {
        setShowLoginModal(false);
      }
    } catch (error) {
      console.error("Login failed", error);
      setLoginError("Google 登入失敗");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const authEmail = loginEmail.includes('@') ? loginEmail : `${loginEmail}@admin.local`;
      const result = await signInWithEmailAndPassword(auth, authEmail, loginPassword);
      const userDoc = await getDocFromServer(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        setLoginError("登入錯誤 無使用權限 請聯繫管理員");
      } else {
        setShowLoginModal(false);
        setLoginEmail('');
        setLoginPassword('');
      }
    } catch (error) {
      console.error("Login failed", error);
      setLoginError("登入錯誤 無使用權限 請聯繫管理員");
    }
  };

  const handleLogout = () => signOut(auth);

  const sendTelegramMessage = async (text: string) => {
    if (!tgSettings.botToken || !tgSettings.chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${tgSettings.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgSettings.chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  };

  const sendLineMessage = async (text: string) => {
    if (!lineSettings.channelAccessToken || !lineSettings.userId) return;
    try {
      // Clean HTML tags for LINE as it doesn't support HTML formatting like Telegram
      const plainText = text.replace(/<b>(.*?)<\/b>/g, '$1').replace(/<a.*?>/g, '').replace(/<\/a>/g, '');
      
      await fetch('/api/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelAccessToken: lineSettings.channelAccessToken,
          userId: lineSettings.userId,
          message: plainText
        })
      });
    } catch (error) {
      console.error('Error sending LINE message:', error);
    }
  };

  const sendPlanCloseNotification = async (planId: string, isManual: boolean = false) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    if (!isManual && !tgSettings.notifyPlanClose && !lineSettings.notifyPlanClose) return;

    if (isManual && (!tgSettings.botToken || !tgSettings.chatId) && (!lineSettings.channelAccessToken || !lineSettings.userId)) {
      alert('發送失敗：請先至設定填寫 Telegram 或 Line 的相關金鑰');
      return;
    }

    const store = stores.find(s => s.id === plan.storeId);
    
    // Fetch latest orders directly from Firestore to avoid closure issues in intervals
    let planOrders: Order[] = [];
    try {
      const ordersSnapshot = await getDocs(query(collection(db, 'orders'), where('planId', '==', plan.id)));
      planOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (e) {
      console.error('Failed to fetch orders for notification:', e);
      planOrders = orders.filter(o => o.planId === plan.id); // fallback
    }
    
    const dishSummary: { [dishId: string]: { name: string, price: number, totalQuantity: number, users: string[] } } = {};
    planOrders.forEach(o => {
      const d = dishes.find(dd => dd.id === o.dishId);
      if (d) {
        if (!dishSummary[d.id]) {
          dishSummary[d.id] = { name: d.name, price: d.price, totalQuantity: 0, users: [] };
        }
        dishSummary[d.id].totalQuantity += o.quantity;
        dishSummary[d.id].users.push(`${o.userName}(${o.quantity})`);
      }
    });

    const sortedDishes = Object.values(dishSummary).sort((a, b) => b.price - a.price);
    let summaryA = sortedDishes.map(d => `$${d.price} ${d.name} x ${d.totalQuantity}`).join('\n');
    let totalQ = sortedDishes.reduce((sum, d) => sum + d.totalQuantity, 0);
    let totalAmount = sortedDishes.reduce((sum, d) => sum + d.price * d.totalQuantity, 0);
    summaryA += `\n總數量：${totalQ} 份\n總金額：$${totalAmount}`;

    let summaryB = sortedDishes.map(d => `* ${d.name} (${d.totalQuantity}): ${d.users.join(', ')}`).join('\n');

    const text = `🛑 <b>結單通知</b>

<b>方案名:</b> ${plan.name}
<b>店家:</b> ${store?.name || '未知'}
<b>用餐日期:</b> ${plan.diningDate}

====================
<b>📊 明細彙整:</b>

<b>【A區 - 報單用】</b>
${summaryA}

<b>【B區 - 取餐比對用】</b>
${summaryB}`;

    if (isManual || tgSettings.notifyPlanClose) {
      await sendTelegramMessage(text);
    }
    if (isManual || lineSettings.notifyPlanClose) {
      await sendLineMessage(text);
    }
  };

  const submitReport = async () => {
    if (!reportText.trim()) return;
    if (!tgSettings.notifyReport && !lineSettings.notifyReport) {
      alert('管理員未啟用回報通知功能。');
      return;
    }

    let text = '';
    if (reportPlanId) {
      const plan = plans.find(p => p.id === reportPlanId);
      if (plan) {
        const store = stores.find(s => s.id === plan.storeId);
        text = `⚠️ <b>使用者回報 (方案)</b>
    
<b>方案名:</b> ${plan.name}
<b>店家:</b> ${store?.name || '未知'}
<b>時間:</b> ${new Date().toLocaleString('zh-TW')}

<b>內容:</b>
${reportText}`;
      }
    }

    if (!text) {
      text = `⚠️ <b>系統意見回報</b>
    
<b>時間:</b> ${new Date().toLocaleString('zh-TW')}

<b>內容:</b>
${reportText}`;
    }

    if (tgSettings.notifyReport) {
      await sendTelegramMessage(text);
    }
    if (lineSettings.notifyReport) {
      await sendLineMessage(text);
    }
    alert('已成功發送您的回報！');
    setShowReportModal(false);
    setReportText('');
    setReportPlanId(null);
  };

  const handleOrder = async () => {
    const q = Number(quantity);
    if (!selectedPlan || !selectedDish || !userName || isNaN(q) || q < 1) return;
    
    const orderData = {
      planId: selectedPlan.id,
      dishId: selectedDish.id,
      userName,
      uid: user?.uid || '',
      quantity: q,
      isPaid: false,
      timestamp: new Date().toISOString()
    };

    try {
      if (editingOrderId) {
        await setDoc(doc(db, 'orders', editingOrderId), { ...orderData, id: editingOrderId });
      } else {
        const orderRef = doc(collection(db, 'orders'));
        const id = orderRef.id;
        await setDoc(orderRef, { ...orderData, id });
        
        // Notify new order
        if (tgSettings.notifyNewOrder || lineSettings.notifyNewOrder) {
          const store = stores.find(s => s.id === selectedPlan.storeId);
          // Get all orders for this plan, append the new one for calculating summary
          const planOrders = orders.filter(o => o.planId === selectedPlan.id);
          const allOrdersForPlan = [...planOrders, { ...orderData, id } as Order];
          
          let existingOrdersText = planOrders.map(o => {
            const d = dishes.find(dd => dd.id === o.dishId);
            return `${o.userName}: ${d?.name || '未知菜色'} x${o.quantity}`;
          }).join('\n');
          
          if (!existingOrdersText) existingOrdersText = '尚無其他訂單';

          // Group by dish for summary
          const dishSummary: { [dishId: string]: { name: string, price: number, totalQuantity: number, users: string[] } } = {};
          allOrdersForPlan.forEach(o => {
            const d = dishes.find(dd => dd.id === o.dishId);
            if (d) {
              if (!dishSummary[d.id]) {
                dishSummary[d.id] = { name: d.name, price: d.price, totalQuantity: 0, users: [] };
              }
              dishSummary[d.id].totalQuantity += o.quantity;
              dishSummary[d.id].users.push(`${o.userName}(${o.quantity})`);
            }
          });

          // A區 - 報單用
          const sortedDishes = Object.values(dishSummary).sort((a, b) => b.price - a.price);
          let summaryA = sortedDishes.map(d => `$${d.price} ${d.name} x ${d.totalQuantity}`).join('\n');
          let totalQ = sortedDishes.reduce((sum, d) => sum + d.totalQuantity, 0);
          let totalAmount = sortedDishes.reduce((sum, d) => sum + d.price * d.totalQuantity, 0);
          summaryA += `\n總數量：${totalQ} 份\n總金額：$${totalAmount}`;

          // B區 - 取餐比對用
          let summaryB = sortedDishes.map(d => `* ${d.name} (${d.totalQuantity}): ${d.users.join(', ')}`).join('\n');

          const newOrderDish = dishes.find(d => d.id === selectedDish.id)?.name || '未知菜色';

          const text = `🔔 <b>下單通知</b>

<b>方案名:</b> ${selectedPlan.name}
<b>店家:</b> ${store?.name || '未知'}
<b>用餐日期:</b> ${selectedPlan.diningDate}
<b>截止時間:</b> ${selectedPlan.closingTime.replace('T', ' ')}

<b>🆕 新訂單:</b>
${userName} - ${newOrderDish} x${q}

====================
<b>📜 原有訂單:</b>
${existingOrdersText}

====================
<b>📊 明細彙整:</b>

<b>【A區 - 報單用】</b>
${summaryA}

<b>【B區 - 取餐比對用】</b>
${summaryB}`;

          if (tgSettings.notifyNewOrder) {
            sendTelegramMessage(text);
          }
          if (lineSettings.notifyNewOrder) {
            sendLineMessage(text);
          }
        }
      }
      
      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        setSelectedPlan(null);
        setSelectedDish(null);
        setQuantity(1);
        setEditingOrderId(null);
      }, 2000);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'orders');
    }
  };

  const startEditOrder = (order: Order) => {
    const plan = plans.find(p => p.id === order.planId);
    const dish = dishes.find(d => d.id === order.dishId);
    if (plan && dish) {
      setSelectedPlan(plan);
      setSelectedDish(dish);
      setUserName(order.userName);
      setQuantity(order.quantity || 1);
      setEditingOrderId(order.id);
      setView('user');
    }
  };

  const openAdminCreateOrderModal = (planId: string) => {
    setAdminEditingOrder(null);
    setAdminOrderPlanId(planId);
    setAdminOrderUserName('');
    const targetPlan = plans.find(p => p.id === planId);
    const storeDishes = targetPlan ? dishes.filter(d => d.storeId === targetPlan.storeId) : [];
    setAdminOrderDishId(storeDishes.length > 0 ? storeDishes[0].id : '');
    setAdminOrderQuantity(1);
    setAdminOrderIsPaid(false);
    setAdminOrderSearchDish('');
    setAdminOrderNotify(false);
    setShowAdminOrderModal(true);
  };

  const openAdminEditOrderModal = (order: Order) => {
    setAdminEditingOrder(order);
    setAdminOrderPlanId(order.planId);
    setAdminOrderUserName(order.userName);
    setAdminOrderDishId(order.dishId);
    setAdminOrderQuantity(order.quantity || 1);
    setAdminOrderIsPaid(!!order.isPaid);
    setAdminOrderSearchDish('');
    setAdminOrderNotify(false);
    setShowAdminOrderModal(true);
  };

  const handleAdminPlanChange = (newPlanId: string) => {
    setAdminOrderPlanId(newPlanId);
    const targetPlan = plans.find(p => p.id === newPlanId);
    const storeDishes = targetPlan ? dishes.filter(d => d.storeId === targetPlan.storeId) : [];
    if (!storeDishes.some(d => d.id === adminOrderDishId)) {
      setAdminOrderDishId(storeDishes.length > 0 ? storeDishes[0].id : '');
    }
  };

  const handleSaveAdminOrder = async () => {
    if (!adminOrderPlanId) {
      alert('請選擇方案！');
      return;
    }
    if (!adminOrderUserName.trim()) {
      alert('請填寫訂購人姓名或代號！');
      return;
    }
    if (!adminOrderDishId) {
      alert('請選擇菜色品項！');
      return;
    }
    const q = Number(adminOrderQuantity);
    if (isNaN(q) || q < 1) {
      alert('數量至少需為 1 份！');
      return;
    }

    setAdminOrderSaving(true);
    try {
      const orderData = {
        planId: adminOrderPlanId,
        dishId: adminOrderDishId,
        userName: adminOrderUserName.trim(),
        uid: adminEditingOrder ? (adminEditingOrder.uid || '') : (user?.uid || ''),
        quantity: q,
        isPaid: adminOrderIsPaid,
        timestamp: adminEditingOrder ? adminEditingOrder.timestamp : new Date().toISOString()
      };

      if (adminEditingOrder) {
        await setDoc(doc(db, 'orders', adminEditingOrder.id), {
          ...orderData,
          id: adminEditingOrder.id
        }, { merge: true });
      } else {
        const orderRef = doc(collection(db, 'orders'));
        const newOrderId = orderRef.id;
        await setDoc(orderRef, {
          ...orderData,
          id: newOrderId
        });

        // Optional notify
        if (adminOrderNotify && (tgSettings.notifyNewOrder || lineSettings.notifyNewOrder)) {
          const targetPlan = plans.find(p => p.id === adminOrderPlanId);
          if (targetPlan) {
            const store = stores.find(s => s.id === targetPlan.storeId);
            const dish = dishes.find(d => d.id === adminOrderDishId);
            const isPlanClosed = targetPlan.isClosed || isAfter(new Date(), parseISO(targetPlan.closingTime));
            const noteTag = isPlanClosed ? '【管理員補單】' : '【管理員代點】';
            const text = `🔔 <b>${noteTag} 下單通知</b>

<b>方案名:</b> ${targetPlan.name}
<b>店家:</b> ${store?.name || '未知店家'}
<b>用餐日期:</b> ${targetPlan.diningDate}

<b>🆕 訂單內容:</b>
${adminOrderUserName.trim()} - ${dish?.name || '未知菜色'} x${q} (金額: $${(dish?.price || 0) * q})
<b>付款狀態:</b> ${adminOrderIsPaid ? '已付款' : '未付款'}`;

            if (tgSettings.notifyNewOrder) {
              sendTelegramMessage(text);
            }
            if (lineSettings.notifyNewOrder) {
              sendLineMessage(text);
            }
          }
        }
      }

      setShowAdminOrderModal(false);
      setAdminEditingOrder(null);
    } catch (e) {
      console.error('Save admin order error:', e);
      handleFirestoreError(e, OperationType.WRITE, 'orders');
    } finally {
      setAdminOrderSaving(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Method 1: Modern navigator.clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
      }
    }

    // Method 2: Synchronous document.execCommand('copy') fallback (effective inside iframes & mobile webviews)
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '-9999px';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.fontSize = '16px'; // Prevent zooming on iOS Safari
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        return true;
      }
    } catch (err) {
      console.error('document.execCommand copy fallback failed:', err);
    }

    return false;
  };

  const handleCopySectionA = async (plan: Plan, sortedDishGroups: { dish: Dish | undefined; totalQuantity: number; users: { name: string; quantity: number }[] }[]) => {
    const details = sortedDishGroups.map(group => `$${group.dish?.price || 0} ${group.dish?.name || '未知菜色'} X ${group.totalQuantity}`).join('\n');
    const totalQ = sortedDishGroups.reduce((acc, group) => acc + group.totalQuantity, 0);
    const totalA = sortedDishGroups.reduce((acc, group) => acc + (group.dish?.price || 0) * group.totalQuantity, 0);
    const copyText = `${details}\n\n總數量：${totalQ} 份\n總金額：$${totalA}`;

    const success = await copyToClipboard(copyText);
    if (success) {
      setCopiedSummaryKey(`A-${plan.id}`);
      setTimeout(() => {
        setCopiedSummaryKey(null);
      }, 2500);
    } else {
      setFallbackCopyText(copyText);
    }
  };

  const handleCopySectionB = async (plan: Plan, sortedDishGroups: { dish: Dish | undefined; totalQuantity: number; users: { name: string; quantity: number }[] }[]) => {
    const details = sortedDishGroups.map(group => {
      const userList = group.users.map(u => u.quantity > 1 ? `${u.name}X${u.quantity}` : u.name).join('、');
      return `$${group.dish?.price || 0} ${group.dish?.name || '未知菜色'} X ${group.totalQuantity}\n${userList}`;
    }).join('\n\n');
    const totalQ = sortedDishGroups.reduce((acc, group) => acc + group.totalQuantity, 0);
    const totalA = sortedDishGroups.reduce((acc, group) => acc + (group.dish?.price || 0) * group.totalQuantity, 0);
    const copyText = `${details}\n\n總數量：${totalQ} 份\n總金額：$${totalA}`;

    const success = await copyToClipboard(copyText);
    if (success) {
      setCopiedSummaryKey(`B-${plan.id}`);
      setTimeout(() => {
        setCopiedSummaryKey(null);
      }, 2500);
    } else {
      setFallbackCopyText(copyText);
    }
  };

  const addAdminUser = async () => {
    if (!newAdminUser.email) return;
    if (!editingAdminId && !newAdminUser.password) return;
    
    try {
      const authEmail = newAdminUser.email.includes('@') ? newAdminUser.email : `${newAdminUser.email}@admin.local`;
      
      if (editingAdminId) {
        // Only update permissions and password in Firestore
        // Note: This doesn't update the actual Firebase Auth password unless we sign in as them
        // For simplicity, we just update the Firestore record
        const updateData: any = {
          email: authEmail,
          role: 'sub-admin',
          permissions: newAdminUser.permissions
        };
        if (newAdminUser.password) {
          updateData.password = newAdminUser.password;
        }
        await setDoc(doc(db, 'users', editingAdminId), updateData, { merge: true });
        setEditingAdminId(null);
      } else {
        const result = await createUserWithEmailAndPassword(secondaryAuth, authEmail, newAdminUser.password);
        await setDoc(doc(db, 'users', result.user.uid), {
          email: authEmail,
          password: newAdminUser.password,
          role: 'sub-admin',
          permissions: newAdminUser.permissions
        });
        await signOut(secondaryAuth);
      }
      setNewAdminUser({ email: '', password: '', permissions: { plans: false, stores: false, dishes: false, orders: false, announcement: false } });
    } catch (e) {
      console.error(e);
      alert('儲存管理員失敗: ' + (e as Error).message);
    }
  };

  const removeAdminUser = async (adminId: string, email: string, password?: string) => {
    if (!password) {
      alert('無法刪除，缺少密碼資訊');
      return;
    }
    try {
      const authEmail = email.includes('@') ? email : `${email}@admin.local`;
      await signInWithEmailAndPassword(secondaryAuth, authEmail, password);
      if (secondaryAuth.currentUser) {
        await deleteUser(secondaryAuth.currentUser);
      }
      await deleteDoc(doc(db, 'users', adminId));
    } catch (e) {
      console.error(e);
      alert('刪除管理員失敗: ' + (e as Error).message);
    }
  };

  const updateTgSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'telegram'), tgSettings);
      alert('Telegram 通知設定已儲存');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    }
  };

  const testTgNotification = () => {
    const text = '🎉 <b>測試通知</b>\n\n這是一則來自訂單系統的測試通知，如果您收到這則訊息，表示 Telegram 通知設定正確！';
    sendTelegramMessage(text);
    alert('已送出測試通知，請檢查您的 Telegram');
  };

  const updateLineSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'line'), lineSettings);
      alert('Line 通知設定已儲存');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    }
  };

  const testLineNotification = () => {
    const text = '🎉 測試通知\n\n這是一則來自訂單系統的測試通知，如果您收到這則訊息，表示 Line 通知設定正確！';
    sendLineMessage(text);
    alert('已送出測試通知，請檢查您的 Line');
  };

  const addStore = async () => {
    if (!newStore.name) return;

    const performSave = async () => {
      try {
        if (editingStoreId) {
          await setDoc(doc(db, 'stores', editingStoreId), { ...newStore, id: editingStoreId }, { merge: true });
          setEditingStoreId(null);
        } else {
          const storeRef = doc(collection(db, 'stores'));
          const id = storeRef.id;
          await setDoc(storeRef, { id, ...newStore });
        }
        setNewStore({ name: '', description: '' });
        setConfirmAction(null);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'stores');
      }
    };

    setConfirmAction({
      title: editingStoreId ? "確認修改店家？" : "確認新增店家？",
      message: `確定要${editingStoreId ? "修改" : "新增"}「${newStore.name}」嗎？`,
      onConfirm: performSave
    });
  };

  const startEditStore = (store: Store) => {
    setNewStore({ name: store.name, description: store.description });
    setEditingStoreId(store.id);
  };

  const exportStores = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stores));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "stores.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importStores = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedStores = JSON.parse(e.target?.result as string);
          if (Array.isArray(importedStores)) {
            for (const store of importedStores) {
              if (store.name) {
                const storeRef = doc(collection(db, 'stores'));
                await setDoc(storeRef, {
                  id: storeRef.id,
                  name: store.name,
                  description: store.description || ''
                });
              }
            }
            alert('店家匯入成功！');
          }
        } catch (error) {
          console.error("Error importing stores:", error);
          alert('匯入失敗，請確認檔案格式是否正確。');
        }
      };
      reader.readAsText(file);
    }
    // Reset input
    event.target.value = '';
  };

  const addDish = async () => {
    const price = parseFloat(newDish.price);
    if (!newDish.name || !newDish.storeId || isNaN(price) || price < 0) return;
    
    const performSave = async () => {
      try {
        if (editingDishId) {
          await setDoc(doc(db, 'dishes', editingDishId), { 
            ...newDish, 
            id: editingDishId,
            price 
          });
          setEditingDishId(null);
        } else {
          const dishRef = doc(collection(db, 'dishes'));
          const id = dishRef.id;
          await setDoc(dishRef, { 
            id, 
            ...newDish, 
            price
          });
        }
        setNewDish({ ...newDish, name: '', price: '' }); // Keep storeId and category
        setConfirmAction(null);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'dishes');
      }
    };

    setConfirmAction({
      title: editingDishId ? "確認修改菜色？" : "確認新增菜色？",
      message: `確定要${editingDishId ? "修改" : "新增"}「${newDish.name}」嗎？`,
      onConfirm: performSave
    });
  };

  const exportDishes = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dishes));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "dishes.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importDishes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedDishes = JSON.parse(e.target?.result as string);
          if (Array.isArray(importedDishes)) {
            for (const dish of importedDishes) {
              if (dish.name && dish.price !== undefined && dish.storeId) {
                const dishRef = doc(collection(db, 'dishes'));
                await setDoc(dishRef, {
                  id: dishRef.id,
                  storeId: dish.storeId,
                  name: dish.name,
                  price: Number(dish.price),
                  category: dish.category || ''
                });
              }
            }
            alert('菜品匯入成功！');
          }
        } catch (error) {
          console.error("Error importing dishes:", error);
          alert('匯入失敗，請確認檔案格式是否正確。');
        }
      };
      reader.readAsText(file);
    }
    // Reset input
    event.target.value = '';
  };

  const startEditDish = (dish: Dish) => {
    setNewDish({
      storeId: dish.storeId,
      name: dish.name,
      price: dish.price.toString(),
      category: dish.category || ''
    });
    setEditingDishId(dish.id);
    // Scroll to top of dish form if needed, or just let user find it
  };

  const addBulkDishes = async () => {
    if (!newDish.storeId || !bulkDishInput.trim()) return;
    
    const lines = bulkDishInput.split('\n').filter(l => l.trim());
    const errors: string[] = [];
    
    for (const line of lines) {
      // Expected format: "Dish Name, Price, Category(optional)"
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        errors.push(`Invalid format: ${line}`);
        continue;
      }
      
      const name = parts[0];
      const price = parseFloat(parts[1]);
      const category = parts[2] || newDish.category || '';
      
      if (!name || isNaN(price) || price < 0) {
        errors.push(`Invalid data: ${line}`);
        continue;
      }
      
      const dishRef = doc(collection(db, 'dishes'));
      const id = dishRef.id;
      try {
        await setDoc(dishRef, {
          id,
          storeId: newDish.storeId,
          name,
          price,
          category
        });
      } catch (e) {
        console.error(`Failed to add ${name}`, e);
        errors.push(`Failed to add ${name}`);
      }
    }
    
    if (errors.length > 0) {
      alert(`Finished with some errors:\n${errors.join('\n')}`);
    } else {
      setBulkDishInput('');
    }
  };

  const addPlan = async () => {
    if (!newPlan.name || !newPlan.storeId || !newPlan.diningDate || !newPlan.closingTime) return;
    const planRef = doc(collection(db, 'plans'));
    const id = planRef.id;
    try {
      await setDoc(planRef, { id, ...newPlan });
      
      const store = stores.find(s => s.id === newPlan.storeId);
      const text = `📢 <b>新方案開團通知</b>\n\n方案名: ${newPlan.name}\n店家: ${store?.name || '未知'}\n用餐日期: ${newPlan.diningDate}\n截止時間: ${newPlan.closingTime.replace('T', ' ')}\n\n🔗 前往訂單系統：\nhttps://s-bbanto.vercel.app/`;
      if (tgSettings.notifyNewPlan) {
        sendTelegramMessage(text);
      }
      if (lineSettings.notifyNewPlan) {
        sendLineMessage(text);
      }

      setNewPlan({ name: '', storeId: '', diningDate: '', closingTime: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'plans');
    }
  };

  const deleteItem = async (col: string, id: string) => {
    try {
      if (col === 'users') {
        const admin = adminUsers.find(u => u.id === id);
        if (admin) {
          await removeAdminUser(admin.id, admin.email, admin.password);
        }
      } else {
        await deleteDoc(doc(db, col, id));
      }
      setConfirmDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, col);
    }
  };

  const updateAnnouncement = async () => {
    try {
      await setDoc(doc(db, 'announcements', 'global'), {
        id: 'global',
        ...announcementEdit,
        updatedAt: new Date().toISOString()
      });
      alert('公告已更新');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'announcements');
    }
  };

  const togglePaymentStatus = async (order: Order) => {
    try {
      await setDoc(doc(db, 'orders', order.id), {
        ...order,
        isPaid: !order.isPaid
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'orders');
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-300 font-sans bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 transition-colors duration-300 backdrop-blur-md bg-white/80 border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('user')}>
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-9 h-9 sm:w-10 sm:h-10 object-cover rounded-xl shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform bg-white"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.classList.remove('hidden');
                    e.currentTarget.nextElementSibling.classList.add('flex');
                  }
                }}
              />
              <div className="hidden w-9 h-9 sm:w-10 sm:h-10 bg-orange-600 rounded-xl items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="font-display font-black text-lg sm:text-xl tracking-tight">{t('title')}</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme & Language Switchers */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={() => {
                    setReportPlanId(null);
                    setShowReportModal(true);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-orange-600 transition-colors px-1"
                  title="系統回報"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">回報</span>
                </button>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="bg-transparent text-xs font-bold border-none focus:ring-0 cursor-pointer px-1 text-zinc-700"
                >
                  <option value="zh">繁中</option>
                  <option value="en">EN</option>
                  <option value="vi">VN</option>
                </select>
              </div>

              {user ? (
                <>
                  {isAdmin && (
                    <button 
                      onClick={() => setView(view === 'user' ? 'admin' : 'user')}
                      className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-600 hover:text-orange-600 transition-colors"
                    >
                      {view === 'user' ? (
                        <><Settings className="w-4 h-4" /> <span className="hidden sm:inline">{t('adminBackend')}</span><span className="sm:hidden">後台</span></>
                      ) : (
                        <><ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">{t('backToFront')}</span><span className="sm:hidden">前台</span></>
                      )}
                    </button>
                  )}
                  <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-zinc-200">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-bold">{user.displayName}</div>
                      <div className="text-[10px] text-zinc-400">{user.email?.replace('@admin.local', '')}</div>
                    </div>
                    {user.photoURL ? (
                      <img src={user.photoURL} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-zinc-100" alt="" />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-zinc-100 bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs uppercase">
                        {user.email?.replace('@admin.local', '')?.[0] || 'U'}
                      </div>
                    )}
                    <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-900 transition-colors"><LogOut className="w-4 h-4" /></button>
                  </div>
                </>
              ) : (
                <Button onClick={() => setShowLoginModal(true)} variant="outline" className="text-xs sm:text-sm py-1.5 px-2.5 sm:px-3">
                  <LogIn className="w-4 h-4" /> {t('login')}
                </Button>
              )}
            </div>
          </div>

          {/* Sub Header Row for Shortcut Setup & Version */}
          <div className="flex items-center justify-between text-xs border-t border-zinc-100/80 pt-1.5 mt-2 px-0.5">
            <button 
              onClick={() => setShowShortcutModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-orange-600 transition-colors bg-zinc-100/80 hover:bg-zinc-200/80 px-2.5 py-1 rounded-full"
              title="捷徑設置"
            >
              <Smartphone className="w-3.5 h-3.5 text-orange-600" />
              <span>捷徑設置</span>
            </button>
            
            <button 
              onClick={() => setShowVersionHistory(true)}
              className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100/80 px-2 py-0.5 rounded hover:bg-zinc-200 hover:text-zinc-600 transition-colors"
              title="版本歷史"
            >
              {APP_VERSION}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="py-20 text-center text-zinc-400">{t('loading')}</div>
        ) : view === 'user' ? (
          <div className="space-y-8">
            {/* User View Tabs */}
            {!selectedPlan && (
              <div className="flex gap-1 bg-zinc-100 -zinc-800 p-1.5 rounded-2xl w-fit border border-zinc-200 -zinc-700">
                <button
                  onClick={() => setUserTab('plans')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                    userTab === 'plans' ? "bg-white -zinc-700 text-orange-600 -orange-400 shadow-sm" : "text-zinc-500 hover:text-zinc-700 -zinc-300"
                  )}
                >
                  {t('plans')}
                </button>
                <button
                  onClick={() => setUserTab('all-orders')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                    userTab === 'all-orders' ? "bg-white -zinc-700 text-orange-600 -orange-400 shadow-sm" : "text-zinc-500 hover:text-zinc-700 -zinc-300"
                  )}
                >
                  {t('allOrders')}
                </button>
              </div>
            )}

            {/* User View Content */}
            {userTab === 'plans' ? (
              !selectedPlan ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl font-bold">{t('activePlans')}</h2>
                      <p className="text-zinc-500">{t('selectPlan')}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-green-800">加入 假日就是要訂便當 群組</span>
                        <span className="text-xs font-medium text-green-700">可在第一時間獲取訂餐資訊</span>
                        <a href="https://line.me/ti/g/m3gcXBWuM3" target="_blank" rel="noreferrer" className="text-xs font-mono font-medium text-blue-600 hover:underline">https://line.me/ti/g/m3gcXBWuM3</a>
                      </div>
                      <div 
                        className="w-10 h-10 bg-white rounded-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-sm overflow-hidden border border-green-200 shrink-0"
                        onClick={() => setShowQrModal(true)}
                      >
                        <img 
                          src="/qr.jpg" 
                          alt="QR Code" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2316a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/><path d="M12 12h.01"/><path d="M12 17h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>';
                            e.currentTarget.className = "w-6 h-6";
                          }}
                        />
                      </div>
                    </div>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plans.filter(p => !p.isClosed && isAfter(parseISO(p.closingTime), new Date())).map(plan => {
                    const store = stores.find(s => s.id === plan.storeId);
                    return (
                      <motion.div 
                        key={plan.id}
                        whileHover={{ y: -6, scale: 1.02 }}
                        onClick={() => setSelectedPlan(plan)}
                        className="cursor-pointer"
                      >
                        <Card className="p-6 hover:border-orange-200 -orange-900 transition-all group relative">
                          <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1.5">
                              <h3 className="font-display font-bold text-2xl group-hover:text-orange-600 -hover:text-orange-400 transition-colors">{plan.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-zinc-500 -zinc-400">
                                <div className="w-6 h-6 rounded-full bg-zinc-100 -zinc-800 flex items-center justify-center">
                                  <Store className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-medium">{store?.name || '未知店家'}</span>
                              </div>
                            </div>
                            <div className="flex bg-orange-50 -orange-900/20 rounded-full divide-x divide-orange-200 overflow-hidden border border-orange-100">
                              <div className="text-orange-700 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center">
                                進行中
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportPlanId(plan.id);
                                  setShowReportModal(true);
                                }}
                                className="text-orange-600 hover:bg-orange-100 hover:text-orange-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center"
                                title="問題回報"
                              >
                                回報
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-zinc-50 -zinc-800">
                            <div className="space-y-1.5">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-400 -zinc-500 font-black">用餐日期</div>
                              <div className="flex items-center gap-2 text-sm font-bold">
                                <Calendar className="w-4 h-4 text-orange-500/60" />
                                {plan.diningDate}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-400 -zinc-500 font-black">截止時間</div>
                              <div className="flex items-center gap-2 text-sm font-bold">
                                <Clock className="w-4 h-4 text-orange-500/60" />
                                {format(parseISO(plan.closingTime), 'MM/dd HH:mm')}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {plans.filter(p => !p.isClosed && isAfter(parseISO(p.closingTime), new Date())).length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                        <Utensils className="w-8 h-8 text-zinc-300" />
                      </div>
                      <p className="text-zinc-400 font-medium">目前沒有進行中的團購</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-8">
                <button 
                  onClick={() => setSelectedPlan(null)}
                  className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> 返回列表
                </button>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">{selectedPlan.name}</h2>
                    <p className="text-zinc-500">來自 {stores.find(s => s.id === selectedPlan.storeId)?.name}</p>
                  </div>

                  <Card className="p-8 space-y-8">
                    {/* Step 1: Name */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                        <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">1</span>
                        輸入姓名或代號
                      </div>
                      <Input 
                        value={userName}
                        onChange={setUserName}
                        placeholder="例如：王小明 或 A01"
                        className="max-w-md"
                      />
                    </div>

                    {/* Step 2: Choose Dish & Quantity */}
                    <AnimatePresence>
                      {userName && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="space-y-8 pt-8 border-t border-zinc-100 -zinc-800"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-black text-zinc-400 -zinc-500 uppercase tracking-widest">
                              <span className="w-6 h-6 rounded-full bg-zinc-100 -zinc-800 flex items-center justify-center text-zinc-500">2</span>
                              選擇菜色
                            </div>
                            <div className="space-y-8">
                              {(() => {
                                const storeDishes = dishes.filter(d => d.storeId === selectedPlan.storeId);
                                const categories = Array.from(new Set(storeDishes.map(d => d.category || '其它')));
                                
                                return categories.map(cat => (
                                  <div key={cat} className="space-y-3">
                                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">{cat}</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                      {storeDishes.filter(d => (d.category || '其它') === cat).map(dish => (
                                        <div 
                                          key={dish.id}
                                          onClick={() => setSelectedDish(dish)}
                                          className={cn(
                                            "p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center group relative overflow-hidden",
                                            selectedDish?.id === dish.id 
                                              ? "border-orange-500 bg-orange-50/50 -orange-900/10" 
                                              : "border-zinc-100 -zinc-800 bg-white -zinc-900/50 hover:border-orange-200 -orange-900"
                                          )}
                                        >
                                          <div className="font-display font-bold text-lg group-hover:text-orange-600 -hover:text-orange-400 transition-colors">{dish.name}</div>
                                          <div className="text-orange-600 -orange-400 font-black text-xl">
                                            <span className="text-sm font-bold mr-0.5">$</span>{dish.price}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-black text-zinc-400 -zinc-500 uppercase tracking-widest">
                              <span className="w-6 h-6 rounded-full bg-zinc-100 -zinc-800 flex items-center justify-center text-zinc-500">3</span>
                              數量
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex items-center bg-zinc-100 -zinc-800 p-1 rounded-2xl border border-zinc-200 -zinc-700">
                                <button 
                                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                  className="w-12 h-12 rounded-xl bg-white -zinc-700 shadow-sm flex items-center justify-center hover:bg-zinc-50 -zinc-600 transition-all active:scale-90"
                                >
                                  <Minus className="w-5 h-5 text-zinc-600 -zinc-300" />
                                </button>
                                <span className="text-2xl font-black w-16 text-center font-display">{quantity}</span>
                                <button 
                                  onClick={() => setQuantity(quantity + 1)}
                                  className="w-12 h-12 rounded-xl bg-white -zinc-700 shadow-sm flex items-center justify-center hover:bg-zinc-50 -zinc-600 transition-all active:scale-90"
                                >
                                  <Plus className="w-5 h-5 text-zinc-600 -zinc-300" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Submit */}
                          <div className="pt-4">
                            <Button 
                              disabled={!selectedDish || !userName || orderSuccess}
                              onClick={handleOrder}
                              className="w-full py-4 text-lg"
                            >
                              {orderSuccess ? (
                                <span className="flex items-center justify-center gap-2">
                                  <CheckCircle2 className="w-5 h-5" /> {editingOrderId ? '修改成功！' : '訂購成功！'}
                                </span>
                              ) : (editingOrderId ? '確認修改' : '確認訂購')}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Current Orders for this plan */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-zinc-400" />
                      目前訂單明細
                    </h3>
                    <div className="space-y-3">
                      {orders.filter(o => o.planId === selectedPlan.id).map(order => {
                        const dish = dishes.find(d => d.id === order.dishId);
                        const isMyOrder = (order.uid && user && order.uid === user.uid) || order.userName === userName;
                        return (
                          <div key={order.id} className="bg-white p-4 rounded-xl border border-zinc-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-400 font-bold text-xs">
                                {order.userName.substring(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {order.userName}
                                  {isMyOrder && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">我的</span>}
                                  {order.isPaid ? (
                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> 已付款
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">未付款</span>
                                  )}
                                </div>
                                <div className="text-sm text-zinc-500">{dish?.name} x {order.quantity}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-bold text-orange-600">${(dish?.price || 0) * (order.quantity || 0)}</div>
                                <div className="text-[10px] text-zinc-400">{format(parseISO(order.timestamp), 'HH:mm')}</div>
                              </div>
                              {isMyOrder && (
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => startEditOrder(order)}
                                    className="p-2 text-zinc-400 hover:text-orange-600 transition-colors"
                                    title="修改"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDelete({ col: 'orders', id: order.id })}
                                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {orders.filter(o => o.planId === selectedPlan.id).length === 0 && (
                        <div className="py-8 text-center text-zinc-400 text-sm">目前尚無人訂購</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">所有訂單明細</h2>
                  <p className="text-zinc-500">查看各方案的訂購狀況</p>
                </div>

                {plans.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[...plans].sort((a, b) => b.diningDate.localeCompare(a.diningDate)).map((plan, index) => {
                      const isActive = selectedAllOrdersPlanId ? selectedAllOrdersPlanId === plan.id : index === 0;
                      return (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedAllOrdersPlanId(plan.id)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                            isActive
                              ? "bg-orange-100 text-orange-700"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          )}
                        >
                          {plan.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-8">
                  {(() => {
                    const sortedPlans = [...plans].sort((a, b) => b.diningDate.localeCompare(a.diningDate));
                    const activePlanId = selectedAllOrdersPlanId || (sortedPlans.length > 0 ? sortedPlans[0].id : null);
                    if (!activePlanId) return <div className="py-20 text-center text-zinc-400">目前沒有任何方案</div>;
                    
                    const plan = plans.find(p => p.id === activePlanId);
                    if (!plan) return null;
                    
                    const planOrders = orders.filter(o => o.planId === plan.id);
                    const store = stores.find(s => s.id === plan.storeId);
                    const totalAmount = planOrders.reduce((acc, o) => {
                      const dish = dishes.find(d => d.id === o.dishId);
                      return acc + (dish?.price || 0) * o.quantity;
                    }, 0);
                    
                    const uniqueUsers = new Set(planOrders.map(o => o.userName)).size;
                    const totalQuantity = planOrders.reduce((acc, o) => acc + o.quantity, 0);

                    return (
                      <Card key={plan.id} className="overflow-hidden">
                        <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <h3 className="font-bold text-lg">{plan.name}</h3>
                            <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                              <Store className="w-3 h-3" /> {store?.name} | <Calendar className="w-3 h-3" /> {plan.diningDate}
                            </div>
                          </div>
                          <div className="flex gap-6 text-right">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-400">總訂購人數</div>
                              <div className="text-lg font-bold text-zinc-700">{uniqueUsers} 人</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-400">總訂購數量</div>
                              <div className="text-lg font-bold text-zinc-700">{totalQuantity} 份</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-400">總金額</div>
                              <div className="text-lg font-bold text-orange-600">${totalAmount}</div>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-50">
                                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase text-[10px]">訂購人</th>
                                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase text-[10px]">餐點</th>
                                <th className="px-6 py-3 text-center font-bold text-zinc-400 uppercase text-[10px]">數量</th>
                                <th className="px-6 py-3 text-right font-bold text-zinc-400 uppercase text-[10px]">小計</th>
                                <th className="px-6 py-3 text-center font-bold text-zinc-400 uppercase text-[10px]">狀態</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                              {planOrders.length > 0 ? planOrders.map(order => {
                                const dish = dishes.find(d => d.id === order.dishId);
                                return (
                                  <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium">{order.userName}</td>
                                    <td className="px-6 py-4 text-zinc-600">{dish?.name}</td>
                                    <td className="px-6 py-4 text-center">{order.quantity}</td>
                                    <td className="px-6 py-4 text-right font-bold">${(dish?.price || 0) * order.quantity}</td>
                                    <td className="px-6 py-4 text-center">
                                      {order.isPaid ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                                          <CheckCircle2 className="w-3 h-3" /> 已付款
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400 text-[10px] font-bold">
                                          未付款
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }) : (
                                <tr>
                                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">目前沒有任何訂單</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Admin View */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-3xl font-display font-black tracking-tight">管理後台</h2>
                <p className="text-zinc-500 font-medium">管理店家、菜色與團購方案</p>
              </div>
              <div className="flex bg-zinc-100 -zinc-800 p-1 rounded-xl border border-zinc-200 -zinc-700 overflow-x-auto max-w-full">
                {(['plans', 'stores', 'dishes', 'orders', 'announcement', ...(isSuperAdmin ? ['permissions'] : [])] as const).map(tab => {
                  if (tab !== 'permissions' && !hasPermission(tab as any)) return null;
                  return (
                    <button
                      key={tab}
                      onClick={() => setAdminTab(tab as any)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
                        adminTab === tab ? "bg-white -zinc-700 text-orange-600 -orange-400 shadow-sm" : "text-zinc-500 hover:text-zinc-900 -zinc-300"
                      )}
                    >
                      {tab === 'plans' && '方案'}
                      {tab === 'stores' && '店家'}
                      {tab === 'dishes' && '菜色'}
                      {tab === 'orders' && '訂單'}
                      {tab === 'announcement' && '公告'}
                      {tab === 'permissions' && '管理權限'}
                    </button>
                  );
                })}
              </div>
            </div>

            <Card className="p-6">
              {adminTab === 'plans' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-zinc-50 -zinc-800/50 p-6 rounded-2xl border border-zinc-100 -zinc-700">
                    <Input label="方案名稱" value={newPlan.name} onChange={v => setNewPlan({...newPlan, name: v})} placeholder="例如：週三午餐團" />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-zinc-600 -zinc-400 ml-1">綁定店家</label>
                      <select 
                        value={newPlan.storeId} 
                        onChange={e => setNewPlan({...newPlan, storeId: e.target.value})}
                        className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white -zinc-900 -zinc-800 -white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      >
                        <option value="">選擇店家</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <Input label="用餐日期" type="date" value={newPlan.diningDate} onChange={v => setNewPlan({...newPlan, diningDate: v})} />
                    <Input label="截止時間" type="datetime-local" value={newPlan.closingTime} onChange={v => setNewPlan({...newPlan, closingTime: v})} />
                    <Button onClick={addPlan} className="md:col-span-4 mt-2"><Plus className="w-4 h-4 inline mr-2" /> 新增方案</Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase tracking-wider">
                          <th className="py-3 px-4 font-bold">方案名稱</th>
                          <th className="py-3 px-4 font-bold">店家</th>
                          <th className="py-3 px-4 font-bold">用餐日期</th>
                          <th className="py-3 px-4 font-bold">截止時間</th>
                          <th className="py-3 px-4 font-bold">狀態</th>
                          <th className="py-3 px-4 font-bold">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {plans.map(plan => {
                          const isPlanClosed = plan.isClosed || isAfter(new Date(), parseISO(plan.closingTime));
                          return (
                          <tr key={plan.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-4 px-4 font-bold">{plan.name}</td>
                            <td className="py-4 px-4 text-zinc-600">{stores.find(s => s.id === plan.storeId)?.name}</td>
                            <td className="py-4 px-4 text-zinc-600">{plan.diningDate}</td>
                            <td className="py-4 px-4 text-zinc-600">{format(parseISO(plan.closingTime), 'yyyy/MM/dd HH:mm')}</td>
                            <td className="py-4 px-4">
                              {isPlanClosed ? (
                                <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded-full font-bold">已結單</span>
                              ) : (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">進行中</span>
                              )}
                            </td>
                            <td className="py-4 px-4 flex items-center gap-3">
                              {!isPlanClosed && (
                                <button 
                                  onClick={async () => {
                                    if (confirm(`確定要提早結束「${plan.name}」嗎？`)) {
                                      await setDoc(doc(db, 'plans', plan.id), { ...plan, isClosed: true }, { merge: true });
                                      if (tgSettings.notifyPlanClose || lineSettings.notifyPlanClose) {
                                        await sendPlanCloseNotification(plan.id, false); // False means auto configuration is respected
                                      }
                                      alert('方案已結單！');
                                    }
                                  }} 
                                  className="text-xs text-orange-600 hover:text-orange-700 font-bold bg-orange-50 px-2 py-1 rounded-md"
                                >
                                  結單
                                </button>
                              )}
                              <button onClick={() => setConfirmDelete({ col: 'plans', id: plan.id })} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'stores' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">店家管理</h3>
                    <div className="flex gap-2">
                      <Button onClick={exportStores} variant="outline" className="text-sm py-1.5 px-3">匯出店家</Button>
                      <label className="cursor-pointer bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 px-3 py-1.5 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center">
                        匯入店家
                        <input type="file" accept=".json" className="hidden" onChange={importStores} />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-zinc-50 p-4 rounded-xl">
                    <Input label="店家名稱" value={newStore.name} onChange={v => setNewStore({...newStore, name: v})} placeholder="例如：老王便當" />
                    <Input label="店家描述" value={newStore.description} onChange={v => setNewStore({...newStore, description: v})} placeholder="例如：排骨飯很好吃" />
                    <div className="flex gap-2">
                      <Button onClick={addStore} className="flex-1">
                        {editingStoreId ? <><Edit2 className="w-4 h-4 inline mr-2" /> 更新店家</> : <><Plus className="w-4 h-4 inline mr-2" /> 新增店家</>}
                      </Button>
                      {editingStoreId && (
                        <Button variant="outline" onClick={() => {
                          setEditingStoreId(null);
                          setNewStore({ name: '', description: '' });
                        }}>
                          取消
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stores.map(store => (
                      <div key={store.id} className="p-4 rounded-xl border border-zinc-100 flex justify-between items-center hover:border-orange-200 hover:shadow-sm transition-all group/store">
                        <div>
                          <div className="font-bold text-zinc-800">{store.name}</div>
                          <div className="text-sm text-zinc-500">{store.description}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => startEditStore(store)} 
                            className="p-2 text-zinc-300 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                            title="編輯店家"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete({ col: 'stores', id: store.id })} 
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="刪除店家"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'dishes' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">菜品管理</h3>
                    <div className="flex gap-2">
                      <Button onClick={exportDishes} variant="outline" className="text-sm py-1.5 px-3">匯出菜品</Button>
                      <label className="cursor-pointer bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 px-3 py-1.5 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center">
                        匯入菜品
                        <input type="file" accept=".json" className="hidden" onChange={importDishes} />
                      </label>
                    </div>
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-600">所屬店家</label>
                        <select 
                          value={newDish.storeId} 
                          onChange={e => setNewDish({...newDish, storeId: e.target.value})}
                          className="px-4 py-2 rounded-lg border border-zinc-200 bg-white"
                        >
                          <option value="">選擇店家</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <Input label="菜色名稱" value={newDish.name} onChange={v => setNewDish({...newDish, name: v})} placeholder="例如：招牌排骨飯" />
                      <Input label="價格" type="number" value={newDish.price} onChange={v => setNewDish({...newDish, price: v})} placeholder="100" />
                      <Input label="分類 (選填)" value={newDish.category || ''} onChange={v => setNewDish({...newDish, category: v})} placeholder="例如：主食、小菜" />
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingDishId && (
                        <Button variant="outline" onClick={() => {
                          setEditingDishId(null);
                          setNewDish({ name: '', price: '', storeId: newDish.storeId, category: newDish.category });
                        }}>
                          {t('cancel')}
                        </Button>
                      )}
                      <Button onClick={addDish}>
                        {editingDishId ? <><Edit2 className="w-4 h-4 inline mr-2" /> {t('updateDish')}</> : <><Plus className="w-4 h-4 inline mr-2" /> {t('addDish')}</>}
                      </Button>
                    </div>

                    <div className="pt-6 border-t border-zinc-200 space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-600">批次新增菜色 (格式: 名稱, 價格, 分類)</label>
                        <textarea 
                          value={bulkDishInput}
                          onChange={e => setBulkDishInput(e.target.value)}
                          placeholder="排骨飯, 100, 主食&#10;雞腿飯, 110, 主食&#10;燙青菜, 40, 小菜"
                          className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white min-h-[120px] font-mono text-sm"
                        />
                        <p className="text-[10px] text-zinc-400">每行一筆，逗號分隔。分類可省略（將使用上方填寫的分類）。</p>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={addBulkDishes} variant="outline"><Plus className="w-4 h-4 inline mr-2" /> 批次新增</Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    {stores.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-zinc-100">
                        {stores.map((store, index) => {
                          const isActive = adminSelectedDishStoreId ? adminSelectedDishStoreId === store.id : index === 0;
                          const storeDishesCount = dishes.filter(d => d.storeId === store.id).length;
                          return (
                            <button
                              key={store.id}
                              onClick={() => setAdminSelectedDishStoreId(store.id)}
                              className={cn(
                                "px-4 py-2 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all border-b-2 flex items-center gap-2",
                                isActive
                                  ? "border-orange-600 text-orange-600 bg-orange-50/50"
                                  : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                              )}
                            >
                              {store.name}
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                isActive ? "bg-orange-600 text-white" : "bg-zinc-100 text-zinc-400"
                              )}>
                                {storeDishesCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-8">
                      {(() => {
                        const activeStoreId = adminSelectedDishStoreId || (stores.length > 0 ? stores[0].id : null);
                        if (!activeStoreId) return <div className="py-20 text-center text-zinc-400">目前沒有任何店家</div>;
                        
                        const store = stores.find(s => s.id === activeStoreId);
                        if (!store) return null;
                        
                        const storeDishes = dishes.filter(d => d.storeId === store.id);
                        
                        // Group by category
                        const categories = Array.from(new Set(storeDishes.map(d => d.category || '未分類')));

                        return (
                          <div key={store.id} className="space-y-6">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                              <div className="flex items-center gap-3">
                                <Store className="w-5 h-5 text-orange-600" />
                                <h3 className="text-lg font-bold">{store.name}</h3>
                              </div>
                              <span className="text-xs font-bold text-zinc-400">{storeDishes.length} 筆菜色</span>
                            </div>
                            
                            {storeDishes.length > 0 ? (
                              <div className="grid grid-cols-1 gap-8">
                                {categories.map(cat => (
                                  <div key={cat} className="space-y-4">
                                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                      {cat}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {storeDishes.filter(d => (d.category || '未分類') === cat).map(dish => (
                                    <div key={dish.id} className="p-4 rounded-2xl border border-zinc-100 flex justify-between items-center bg-white hover:border-orange-200 hover:shadow-md hover:shadow-orange-500/5 transition-all">
                                          <div>
                                            <div className="font-bold text-zinc-800">{dish.name}</div>
                                            <div className="text-orange-600 font-black mt-1">
                                              <span className="text-[10px] mr-0.5">$</span>
                                              {dish.price}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 transition-opacity">
                                            <button 
                                              onClick={() => startEditDish(dish)}
                                              className="p-2 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                              title={t('edit')}
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={() => setConfirmDelete({ col: 'dishes', id: dish.id })} 
                                              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                              title={t('delete')}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-20 text-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                                <Utensils className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                                <p className="text-zinc-400 font-medium">此店家目前沒有菜色</p>
                                <p className="text-xs text-zinc-300 mt-1">請使用上方表單新增菜色</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'orders' && (
                <div className="space-y-10">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">訂單管理</h3>
                    <div className="flex items-center gap-3">
                      <Button onClick={() => setShowSummaryModal(true)} variant="outline" className="text-sm py-1.5 px-3">
                        明細彙整
                      </Button>
                      <div className="text-sm text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">共 {orders.length} 筆訂單</div>
                    </div>
                  </div>

                  {plans.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-zinc-100">
                      {[...plans].sort((a, b) => b.diningDate.localeCompare(a.diningDate)).map((plan, index) => {
                        const isActive = adminSelectedPlanId ? adminSelectedPlanId === plan.id : index === 0;
                        const isClosed = plan.isClosed || isAfter(new Date(), parseISO(plan.closingTime));
                        return (
                          <button
                            key={plan.id}
                            onClick={() => setAdminSelectedPlanId(plan.id)}
                            className={cn(
                              "px-4 py-2 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5",
                              isActive
                                ? "border-orange-600 text-orange-600 bg-orange-50/50"
                                : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                            )}
                          >
                            <span>{plan.name}</span>
                            {isClosed ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 font-medium">已結單</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">進行中</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-8">
                    {(() => {
                      const sortedPlans = [...plans].sort((a, b) => b.diningDate.localeCompare(a.diningDate));
                      const activePlanId = adminSelectedPlanId || (sortedPlans.length > 0 ? sortedPlans[0].id : null);
                      if (!activePlanId) return <div className="py-20 text-center text-zinc-400">目前沒有任何方案</div>;
                      
                      const plan = plans.find(p => p.id === activePlanId);
                      if (!plan) return null;
                      
                      const planOrders = orders.filter(o => o.planId === plan.id);
                      const store = stores.find(s => s.id === plan.storeId);
                      const isPlanClosed = plan.isClosed || isAfter(new Date(), parseISO(plan.closingTime));
                      
                      // Calculate dish summary for this plan
                      const dishSummary: { [dishId: string]: { name: string, count: number } } = {};
                      let totalAmount = 0;
                      let totalQuantity = 0;
                      planOrders.forEach(order => {
                        const dish = dishes.find(d => d.id === order.dishId);
                        if (!dishSummary[order.dishId]) {
                          dishSummary[order.dishId] = { name: dish?.name || '未知菜色', count: 0 };
                        }
                        dishSummary[order.dishId].count += order.quantity || 0;
                        totalQuantity += order.quantity || 0;
                        totalAmount += (dish?.price || 0) * (order.quantity || 0);
                      });

                      return (
                        <div key={plan.id} className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50 p-6 rounded-2xl border border-zinc-100">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xl font-bold text-zinc-900">{plan.name}</h4>
                                {isPlanClosed ? (
                                  <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    已結單
                                  </span>
                                ) : (
                                  <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    進行中
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-zinc-400" /> {plan.diningDate}</span>
                                <span className="flex items-center gap-1"><Store className="w-4 h-4 text-zinc-400" /> {store?.name || '未知店家'}</span>
                                <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-zinc-400" /> 截止: {plan.closingTime.replace('T', ' ')}</span>
                              </div>
                              <div className="text-xs text-zinc-500 pt-1">
                                目前累計：<span className="font-bold text-orange-600">{totalQuantity}</span> 份，總金額：<span className="font-bold text-orange-600">${totalAmount}</span> 元
                              </div>
                            </div>
                            
                            <div className="flex flex-col md:items-end gap-3">
                              {/* Dish Summary Cards */}
                              <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                                {Object.values(dishSummary).map((item, idx) => (
                                  <div key={idx} className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-orange-100 flex items-center gap-2">
                                    <span>{item.name}</span>
                                    <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded text-[10px] min-w-[20px] text-center">{item.count}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Button 
                                  onClick={() => openAdminCreateOrderModal(plan.id)}
                                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm rounded-xl font-bold"
                                >
                                  <Plus className="w-4 h-4" /> 新增訂單 {isPlanClosed ? '(補單)' : ''}
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={async () => {
                                    if (confirm(`確定要發送「${plan.name}」的結單通知到 Telegram / Line 嗎？`)) {
                                      await sendPlanCloseNotification(plan.id, true);
                                      alert('已觸發發送結單通知！');
                                    }
                                  }}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs py-2 px-3 rounded-xl"
                                >
                                  發送結單通知
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto bg-white rounded-xl border border-zinc-100 shadow-sm">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-zinc-100 text-zinc-400 text-[10px] uppercase tracking-wider">
                                  <th className="py-3 px-4 font-bold">姓名</th>
                                  <th className="py-3 px-4 font-bold">菜色</th>
                                  <th className="py-3 px-4 font-bold">數量</th>
                                  <th className="py-3 px-4 font-bold text-center">付款狀態</th>
                                  <th className="py-3 px-4 font-bold">總金額</th>
                                  <th className="py-3 px-4 font-bold">訂購時間</th>
                                  <th className="py-3 px-4 font-bold">操作</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-50">
                                {planOrders.length > 0 ? planOrders.map(order => {
                                  const dish = dishes.find(d => d.id === order.dishId);
                                  return (
                                    <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                                      <td className="py-4 px-4 font-bold">{order.userName}</td>
                                      <td className="py-4 px-4 text-zinc-600">{dish?.name}</td>
                                      <td className="py-4 px-4 text-zinc-600">{order.quantity || 0}</td>
                                      <td className="py-4 px-4 text-center">
                                        <button 
                                          onClick={() => togglePaymentStatus(order)}
                                          className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                            order.isPaid 
                                              ? "bg-green-100 text-green-700 hover:bg-green-200" 
                                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                          )}
                                        >
                                          {order.isPaid ? '已付款' : '未付款'}
                                        </button>
                                      </td>
                                      <td className="py-4 px-4 text-orange-600 font-bold">${(dish?.price || 0) * (order.quantity || 0)}</td>
                                      <td className="py-4 px-4 text-zinc-400 text-xs">{format(parseISO(order.timestamp), 'MM/dd HH:mm')}</td>
                                      <td className="py-4 px-4">
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => openAdminEditOrderModal(order)} 
                                            className="p-1.5 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                            title="修改訂單 (管理員)"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => setConfirmDelete({ col: 'orders', id: order.id })} 
                                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="刪除訂單"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }) : (
                                  <tr>
                                    <td colSpan={7} className="py-12 text-center text-zinc-400">
                                      <p className="mb-2">目前尚無訂單</p>
                                      <Button 
                                        onClick={() => openAdminCreateOrderModal(plan.id)}
                                        variant="outline"
                                        className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                      >
                                        <Plus className="w-3.5 h-3.5 mr-1" /> 新增第一筆訂單 {isPlanClosed ? '(補單)' : ''}
                                      </Button>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {adminTab === 'announcement' && (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">系統公告設定</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">啟用公告</span>
                        <button 
                          onClick={() => setAnnouncementEdit({...announcementEdit, isActive: !announcementEdit.isActive})}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            announcementEdit.isActive ? "bg-orange-600" : "bg-zinc-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            announcementEdit.isActive ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-600">公告內容</label>
                      <textarea 
                        value={announcementEdit.content}
                        onChange={(e) => setAnnouncementEdit({...announcementEdit, content: e.target.value})}
                        placeholder="輸入公告內容..."
                        className="w-full h-40 px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                      />
                    </div>
                    <Button onClick={updateAnnouncement} className="w-full py-3">儲存公告設定</Button>
                  </div>
                  {announcement?.updatedAt && (
                    <p className="text-xs text-zinc-400 text-center">最後更新時間：{format(parseISO(announcement.updatedAt), 'yyyy/MM/dd HH:mm:ss')}</p>
                  )}
                </div>
              )}
              {adminTab === 'permissions' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">管理權限</h3>
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 space-y-4">
                    <h4 className="font-semibold text-zinc-800">{editingAdminId ? '編輯管理員' : '新增管理員'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="帳號" value={newAdminUser.email} onChange={v => setNewAdminUser({...newAdminUser, email: v})} placeholder="請輸入帳號" disabled={!!editingAdminId} />
                      <Input label="密碼" value={newAdminUser.password} onChange={v => setNewAdminUser({...newAdminUser, password: v})} placeholder="至少 6 個字元" type="password" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-zinc-600 ml-1">可使用的後台功能</label>
                      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-zinc-200">
                        {(['plans', 'stores', 'dishes', 'orders', 'announcement'] as const).map(perm => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!newAdminUser.permissions[perm]}
                              onChange={e => setNewAdminUser({
                                ...newAdminUser, 
                                permissions: { ...newAdminUser.permissions, [perm]: e.target.checked }
                              })}
                              className="w-4 h-4 text-orange-600 rounded border-zinc-300 focus:ring-orange-500"
                            />
                            <span className="text-sm text-zinc-700">
                              {perm === 'plans' && '方案'}
                              {perm === 'stores' && '店家'}
                              {perm === 'dishes' && '菜色'}
                              {perm === 'orders' && '訂單'}
                              {perm === 'announcement' && '公告'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addAdminUser} className="w-full">{editingAdminId ? '儲存變更' : '新增管理員'}</Button>
                      {editingAdminId && (
                        <Button 
                          onClick={() => {
                            setEditingAdminId(null);
                            setNewAdminUser({ email: '', password: '', permissions: { plans: false, stores: false, dishes: false, orders: false, announcement: false } });
                          }} 
                          variant="outline"
                          className="w-full"
                        >
                          取消
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-zinc-800">管理員列表</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {adminUsers.map(admin => (
                        <div key={admin.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="font-medium text-zinc-900">{admin.email.replace('@admin.local', '')}</div>
                            <div className="text-sm text-zinc-500 mt-1 flex gap-2 flex-wrap">
                              {Object.entries(admin.permissions).filter(([_, v]) => v).map(([k]) => (
                                <span key={k} className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
                                  {k === 'plans' && '方案'}
                                  {k === 'stores' && '店家'}
                                  {k === 'dishes' && '菜色'}
                                  {k === 'orders' && '訂單'}
                                  {k === 'announcement' && '公告'}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto">
                            <Button 
                              onClick={() => {
                                setEditingAdminId(admin.id);
                                setNewAdminUser({
                                  email: admin.email.replace('@admin.local', ''),
                                  password: admin.password || '',
                                  permissions: admin.permissions
                                });
                              }}
                              variant="outline" 
                              className="text-zinc-600 hover:bg-zinc-50 border-zinc-200 w-full md:w-auto"
                            >
                              <Edit2 className="w-4 h-4 mr-1" /> 編輯
                            </Button>
                            <Button 
                              onClick={() => setConfirmDelete({ col: 'users', id: admin.id })} 
                              variant="outline" 
                              className="text-red-600 hover:bg-red-50 border-red-200 w-full md:w-auto"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> 刪除
                            </Button>
                          </div>
                        </div>
                      ))}
                      {adminUsers.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-100">
                          尚無其他管理員
                        </div>
                      )}
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4 mt-8">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          Telegram 通知設定 (僅超級管理員可見)
                        </h4>
                        <Button variant="outline" onClick={testTgNotification} className="text-blue-700 border-blue-200 hover:bg-blue-100">
                          測試通知
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                          label="Bot Token" 
                          value={tgSettings.botToken || ''} 
                          onChange={v => setTgSettings({ ...tgSettings, botToken: v })} 
                          placeholder="請輸入 Bot Token" 
                          type="password"
                        />
                        <Input 
                          label="Chat ID" 
                          value={tgSettings.chatId || ''} 
                          onChange={v => setTgSettings({ ...tgSettings, chatId: v })} 
                          placeholder="請輸入 Chat ID" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-blue-800 ml-1">啟用通知項目</label>
                        <div className="flex flex-wrap gap-4 bg-white/60 p-4 rounded-xl border border-blue-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!tgSettings.notifyNewPlan}
                              onChange={e => setTgSettings({ ...tgSettings, notifyNewPlan: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-900">新方案開團通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!tgSettings.notifyNewOrder}
                              onChange={e => setTgSettings({ ...tgSettings, notifyNewOrder: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-900">下單通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!tgSettings.notifyPlanClose}
                              onChange={e => setTgSettings({ ...tgSettings, notifyPlanClose: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-900">結單通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!tgSettings.notifyReport}
                              onChange={e => setTgSettings({ ...tgSettings, notifyReport: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-900">回報通知</span>
                          </label>
                        </div>
                      </div>
                      <Button onClick={updateTgSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0">
                        儲存 TG 設定
                      </Button>
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 space-y-4 mt-8">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-green-600" />
                          Line 通知設定 (僅超級管理員可見)
                        </h4>
                        <Button variant="outline" onClick={testLineNotification} className="text-green-700 border-green-200 hover:bg-green-100">
                          測試通知
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                          label="Channel Access Token" 
                          value={lineSettings.channelAccessToken || ''} 
                          onChange={v => setLineSettings({ ...lineSettings, channelAccessToken: v })} 
                          placeholder="請輸入 Channel Access Token" 
                          type="password"
                        />
                        <Input 
                          label="User ID / Group ID" 
                          value={lineSettings.userId || ''} 
                          onChange={v => setLineSettings({ ...lineSettings, userId: v })} 
                          placeholder="請輸入 User ID 或 Group ID" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-green-800 ml-1">啟用通知項目</label>
                        <div className="flex flex-wrap gap-4 bg-white/60 p-4 rounded-xl border border-green-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!lineSettings.notifyNewPlan}
                              onChange={e => setLineSettings({ ...lineSettings, notifyNewPlan: e.target.checked })}
                              className="w-4 h-4 text-green-600 rounded border-green-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-green-900">新方案開團通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!lineSettings.notifyNewOrder}
                              onChange={e => setLineSettings({ ...lineSettings, notifyNewOrder: e.target.checked })}
                              className="w-4 h-4 text-green-600 rounded border-green-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-green-900">下單通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!lineSettings.notifyPlanClose}
                              onChange={e => setLineSettings({ ...lineSettings, notifyPlanClose: e.target.checked })}
                              className="w-4 h-4 text-green-600 rounded border-green-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-green-900">結單通知</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!lineSettings.notifyReport}
                              onChange={e => setLineSettings({ ...lineSettings, notifyReport: e.target.checked })}
                              className="w-4 h-4 text-green-600 rounded border-green-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-green-900">回報通知</span>
                          </label>
                        </div>
                      </div>
                      <Button onClick={updateLineSettings} className="w-full bg-green-600 hover:bg-green-700 text-white border-0">
                        儲存 Line 設定
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-zinc-900">管理員登入</h3>
                <button onClick={() => setShowLoginModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {loginError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center">
                    {loginError}
                  </div>
                )}
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <Input label="帳號" value={loginEmail} onChange={setLoginEmail} placeholder="輸入管理員帳號" />
                  <Input label="密碼" value={loginPassword} onChange={setLoginPassword} placeholder="輸入密碼" type="password" />
                  <Button type="submit" className="w-full py-3">帳號密碼登入</Button>
                </form>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-zinc-500">或</span>
                  </div>
                </div>
                <Button onClick={handleGoogleLogin} variant="outline" className="w-full py-3 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google 登入
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmAction(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 space-y-6 border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-display font-black tracking-tight">{confirmAction.title}</h3>
                <p className="text-zinc-500 font-medium">{confirmAction.message}</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 py-3" 
                  onClick={() => setConfirmAction(null)}
                >
                  取消
                </Button>
                <Button 
                  className="flex-1 py-3" 
                  onClick={confirmAction.onConfirm}
                >
                  確定
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Announcement Modal */}
      <AnimatePresence>
        {showAnnouncement && announcement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnnouncement(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white -zinc-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 space-y-6 border border-zinc-100 -zinc-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-600">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-display font-black tracking-tight">{t('announcement')}</h3>
                  </div>
                  
                  {/* Version & Update Date Display */}
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowVersionHistory(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200/80 text-orange-700 font-mono text-xs font-bold transition-colors cursor-pointer"
                      title="點擊查看版本歷史紀錄"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      <span>{APP_VERSION}</span>
                    </button>
                    <span className="text-xs text-zinc-400 font-medium">
                      更新日期：<span className="font-mono text-zinc-600 font-semibold">{APP_UPDATE_DATE}</span>
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAnnouncement(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium max-h-[50vh] overflow-y-auto">
                  {announcement.content}
                </p>
              </div>
              
              <div className="space-y-3">
                <Button onClick={() => setShowAnnouncement(false)} className="w-full py-4 text-lg">
                  我知道了
                </Button>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowVersionHistory(true)}
                    className="text-xs text-zinc-400 hover:text-orange-600 transition-colors flex items-center gap-1.5 py-0.5"
                  >
                    <span>版本 {APP_VERSION} ({APP_UPDATE_DATE})</span>
                    <span className="text-zinc-300">·</span>
                    <span className="underline underline-offset-2">查看版本更新紀錄</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white -zinc-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 space-y-6 border border-zinc-100 -zinc-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-50 -red-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-display font-black tracking-tight">確認刪除？</h3>
                <p className="text-zinc-500 -zinc-400 font-medium">此操作無法復原，確定要刪除這筆資料嗎？</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 py-3" 
                  onClick={() => setConfirmDelete(null)}
                >
                  取消
                </Button>
                <Button 
                  variant="danger" 
                  className="flex-1 py-3" 
                  onClick={() => deleteItem(confirmDelete.col, confirmDelete.id)}
                >
                  確定刪除
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowQrModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-6 pb-4 border-b border-zinc-100">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-green-600 font-bold">加入 LINE 群組</span>
                </h3>
                <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex flex-col items-center justify-center bg-zinc-50">
                <div className="w-full aspect-square bg-white rounded-2xl p-4 shadow-sm border border-zinc-200 flex items-center justify-center mb-6">
                  <img 
                    src="/qr.jpg" 
                    alt="LINE QR Code" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%2316a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/><path d="M12 12h.01"/><path d="M12 17h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>';
                      e.currentTarget.className = "w-24 h-24";
                    }}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-zinc-500 font-medium">LINE 群組連結</p>
                  <a href="https://line.me/ti/g/m3gcXBWuM3" target="_blank" rel="noreferrer" className="text-base sm:text-lg font-mono font-bold tracking-tight text-blue-600 hover:underline break-all block px-4">https://line.me/ti/g/m3gcXBWuM3</a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {showVersionHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowVersionHistory(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-orange-600" />
                  版本歷史紀錄
                </h3>
                <button onClick={() => setShowVersionHistory(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto pr-2 space-y-6">
                {VERSION_HISTORY.map((v, idx) => (
                  <div key={idx} className="relative pl-4 border-l-2 border-orange-100/50 pb-2">
                    <div className="absolute w-3 h-3 bg-orange-500 rounded-full -left-[7px] top-1.5 shadow-[0_0_0_4px_white]"></div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-bold text-orange-600 font-mono">{v.version}</span>
                      <span className="text-xs text-zinc-400 font-mono">{v.date}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {v.notes.map((note, noteIdx) => (
                        <li key={noteIdx} className="text-sm text-zinc-600 flex items-start gap-2">
                          <span className="text-orange-400 mt-1">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowReportModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">問題回報</h3>
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1">回報內容</label>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none h-32"
                    placeholder="請輸入您想回報的問題或建議..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 py-3" onClick={() => setShowReportModal(false)}>取消</Button>
                  <Button className="flex-1 py-3" onClick={submitReport}>發送回報</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowSummaryModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-8 flex flex-col max-h-[90vh] border border-zinc-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">訂單明細彙整</h3>
                <button onClick={() => setShowSummaryModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs for Plans */}
              <div className="flex overflow-x-auto pb-2 mb-6 gap-2 border-b border-zinc-100 hide-scrollbar">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSummaryTab(plan.id)}
                    className={cn(
                      "px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors",
                      (summaryTab === plan.id || (!summaryTab && plans[0]?.id === plan.id))
                        ? "bg-zinc-100 text-zinc-900 border-b-2 border-zinc-900"
                        : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {plan.name}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                {plans.filter(p => p.id === (summaryTab || plans[0]?.id)).map(plan => {
                  const planOrders = orders.filter(o => o.planId === plan.id);
                  
                  // Group by dish
                  const dishGroups: { [dishId: string]: { dish: Dish | undefined, totalQuantity: number, users: { name: string, quantity: number }[] } } = {};
                  
                  planOrders.forEach(order => {
                    if (!dishGroups[order.dishId]) {
                      dishGroups[order.dishId] = {
                        dish: dishes.find(d => d.id === order.dishId),
                        totalQuantity: 0,
                        users: []
                      };
                    }
                    dishGroups[order.dishId].totalQuantity += order.quantity;
                    
                    const existingUser = dishGroups[order.dishId].users.find(u => u.name === order.userName);
                    if (existingUser) {
                      existingUser.quantity += order.quantity;
                    } else {
                      dishGroups[order.dishId].users.push({ name: order.userName, quantity: order.quantity });
                    }
                  });

                  const sortedDishGroups = Object.values(dishGroups).sort((a, b) => (b.dish?.price || 0) - (a.dish?.price || 0));

                  return (
                    <div key={plan.id} className="space-y-8">
                      {/* Section A */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="font-bold text-lg text-orange-600">A區 - 報單用</h4>
                          {sortedDishGroups.length > 0 && (
                            <button
                              onClick={() => handleCopySectionA(plan, sortedDishGroups)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                                copiedSummaryKey === `A-${plan.id}`
                                  ? "bg-green-600 text-white"
                                  : "bg-orange-100 hover:bg-orange-200 text-orange-700"
                              )}
                              title="複製A區報單內容"
                            >
                              {copiedSummaryKey === `A-${plan.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  已複製到剪貼簿！
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  一鍵複製A區
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap">
                          {sortedDishGroups.map(group => (
                            <div key={group.dish?.id}>${group.dish?.price || 0} {group.dish?.name || '未知菜色'} X {group.totalQuantity}</div>
                          ))}
                          {sortedDishGroups.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-200 font-bold text-orange-600 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                總數量：{sortedDishGroups.reduce((acc, group) => acc + group.totalQuantity, 0)} 份
                                <span className="ml-4">總金額：${sortedDishGroups.reduce((acc, group) => acc + (group.dish?.price || 0) * group.totalQuantity, 0)}</span>
                              </div>
                              <button
                                onClick={() => handleCopySectionA(plan, sortedDishGroups)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                                  copiedSummaryKey === `A-${plan.id}`
                                    ? "bg-green-600 text-white"
                                    : "bg-orange-600 hover:bg-orange-700 text-white"
                                )}
                              >
                                {copiedSummaryKey === `A-${plan.id}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    已複製！
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    複製報單內容
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                          {sortedDishGroups.length === 0 && <div className="text-zinc-400">尚無訂單</div>}
                        </div>
                      </div>

                      {/* Section B */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="font-bold text-lg text-blue-600">B區 - 取餐比對用</h4>
                          {sortedDishGroups.length > 0 && (
                            <button
                              onClick={() => handleCopySectionB(plan, sortedDishGroups)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                                copiedSummaryKey === `B-${plan.id}`
                                  ? "bg-green-600 text-white"
                                  : "bg-blue-100 hover:bg-blue-200 text-blue-700"
                              )}
                              title="複製B區取餐明細"
                            >
                              {copiedSummaryKey === `B-${plan.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  已複製到剪貼簿！
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  複製B區明細
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl font-mono text-sm space-y-4">
                          {sortedDishGroups.map(group => (
                            <div key={group.dish?.id} className="space-y-1">
                              <div className="font-bold">${group.dish?.price || 0} {group.dish?.name || '未知菜色'} X {group.totalQuantity}</div>
                              <div className="text-zinc-600 pl-2">
                                {group.users.map(u => u.quantity > 1 ? `${u.name}X${u.quantity}` : u.name).join('、')}
                              </div>
                            </div>
                          ))}
                          {sortedDishGroups.length === 0 && <div className="text-zinc-400">尚無訂單</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fallback Manual Copy Modal (When browser / iframe blocks clipboard access) */}
      <AnimatePresence>
        {fallbackCopyText !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
              onClick={() => setFallbackCopyText(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
                    <Copy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900">明細內容複製</h3>
                    <p className="text-xs text-zinc-400">文字已為您全部選取</p>
                  </div>
                </div>
                <button 
                  onClick={() => setFallbackCopyText(null)} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-zinc-500 font-medium">
                  因部分瀏覽器或外嵌視窗安全性限制自動存取剪貼簿，請直接點擊下方文字框（已自動全選），按鍵盤 <kbd className="px-1.5 py-0.5 bg-zinc-200 rounded text-zinc-700 font-mono">Ctrl+C</kbd> / <kbd className="px-1.5 py-0.5 bg-zinc-200 rounded text-zinc-700 font-mono">Cmd+C</kbd> 或長按複製：
                </p>
                <textarea
                  id="fallback-copy-textarea"
                  readOnly
                  rows={8}
                  value={fallbackCopyText}
                  onFocus={e => e.target.select()}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                  className="w-full p-3 font-mono text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 select-all leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 py-2 text-xs font-bold"
                  onClick={() => {
                    const el = document.getElementById('fallback-copy-textarea') as HTMLTextAreaElement;
                    if (el) {
                      el.focus();
                      el.select();
                    }
                  }}
                >
                  全選文字
                </Button>
                <Button
                  className="flex-1 py-2 text-xs font-bold"
                  onClick={() => {
                    const el = document.getElementById('fallback-copy-textarea') as HTMLTextAreaElement;
                    if (el) {
                      el.focus();
                      el.select();
                      try {
                        const ok = document.execCommand('copy');
                        if (ok) {
                          alert('已成功複製到剪貼簿！');
                          setFallbackCopyText(null);
                        } else {
                          alert('請直接按 Ctrl+C / Cmd+C 或長按複製');
                        }
                      } catch (e) {
                        alert('請直接按 Ctrl+C / Cmd+C 或長按複製');
                      }
                    }
                  }}
                >
                  再次嘗試複製
                </Button>
                <Button
                  variant="secondary"
                  className="py-2 px-4 text-xs font-bold"
                  onClick={() => setFallbackCopyText(null)}
                >
                  關閉
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Order Create / Edit Modal */}
      <AnimatePresence>
        {showAdminOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowAdminOrderModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 flex flex-col max-h-[90vh] border border-zinc-100 my-auto overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">
                      {adminEditingOrder ? '修改訂單 (管理員)' : '新增訂單 (管理員補單)'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {adminEditingOrder ? '可調整姓名、餐點品項、數量及付款狀態' : '可為已結單或進行中方案補入新訂單'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAdminOrderModal(false)} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 py-4 overflow-y-auto pr-1">
                {/* Plan Info / Selection */}
                {(() => {
                  const targetPlan = plans.find(p => p.id === adminOrderPlanId);
                  const isPlanClosed = targetPlan ? (targetPlan.isClosed || isAfter(new Date(), parseISO(targetPlan.closingTime))) : false;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-600">方案與狀態</label>
                        {isPlanClosed ? (
                          <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            已結單 (補單模式)
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            進行中
                          </span>
                        )}
                      </div>

                      {adminEditingOrder ? (
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-800 flex justify-between items-center">
                          <span>{targetPlan?.name || '未知方案'}</span>
                          <span className="text-xs text-zinc-400 font-normal">
                            {stores.find(s => s.id === targetPlan?.storeId)?.name}
                          </span>
                        </div>
                      ) : (
                        <select
                          value={adminOrderPlanId}
                          onChange={e => handleAdminPlanChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-zinc-800"
                        >
                          {plans.map(p => {
                            const closed = p.isClosed || isAfter(new Date(), parseISO(p.closingTime));
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} {closed ? '【已結單】' : '【進行中】'} ({p.diningDate})
                              </option>
                            );
                          })}
                        </select>
                      )}

                      {isPlanClosed && (
                        <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200/80 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>此方案已結單或已截止</strong>。身為管理員，您可以直接為錯過時間的同仁補單或更改餐點，送出後將立即同步計入訂單明細與總金額。
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* User Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-600 flex items-center gap-1">
                    <span>訂購人姓名 / 員工代號</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <Input 
                    value={adminOrderUserName}
                    onChange={setAdminOrderUserName}
                    placeholder="例如：王小明 或 A05"
                    className="w-full"
                  />
                </div>

                {/* Dish Selection */}
                {(() => {
                  const targetPlan = plans.find(p => p.id === adminOrderPlanId);
                  const storeDishes = targetPlan ? dishes.filter(d => d.storeId === targetPlan.storeId) : [];
                  const filteredDishes = storeDishes.filter(d => 
                    !adminOrderSearchDish.trim() || 
                    d.name.toLowerCase().includes(adminOrderSearchDish.toLowerCase()) ||
                    (d.category && d.category.toLowerCase().includes(adminOrderSearchDish.toLowerCase()))
                  );

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-600 flex items-center gap-1">
                          <span>選擇菜色品項</span>
                          <span className="text-red-500">*</span>
                        </label>
                        {storeDishes.length > 5 && (
                          <span className="text-[11px] text-zinc-400">共 {storeDishes.length} 種菜色</span>
                        )}
                      </div>

                      {storeDishes.length > 5 && (
                        <div className="relative">
                          <input 
                            type="text"
                            value={adminOrderSearchDish}
                            onChange={e => setAdminOrderSearchDish(e.target.value)}
                            placeholder="快速搜尋菜名或分類..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:border-orange-500"
                          />
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                        </div>
                      )}

                      <div className="max-h-44 overflow-y-auto space-y-1.5 border border-zinc-200 rounded-xl p-2 bg-zinc-50/50">
                        {filteredDishes.length > 0 ? (
                          filteredDishes.map(dish => {
                            const isSelected = adminOrderDishId === dish.id;
                            return (
                              <div
                                key={dish.id}
                                onClick={() => setAdminOrderDishId(dish.id)}
                                className={cn(
                                  "px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between text-sm",
                                  isSelected 
                                    ? "bg-orange-500 text-white font-bold shadow-sm" 
                                    : "bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-100"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{dish.name}</span>
                                  {dish.category && (
                                    <span className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded",
                                      isSelected ? "bg-orange-600 text-white" : "bg-zinc-100 text-zinc-500"
                                    )}>
                                      {dish.category}
                                    </span>
                                  )}
                                </div>
                                <div className={cn(
                                  "font-mono font-bold",
                                  isSelected ? "text-white" : "text-orange-600"
                                )}>
                                  ${dish.price}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-6 text-center text-xs text-zinc-400">
                            {storeDishes.length === 0 ? '此店家尚無菜色，請先至店家管理新增菜色' : '查無符合的菜色'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Quantity & Payment Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Quantity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600">購買數量</label>
                    <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                      <button 
                        type="button"
                        onClick={() => setAdminOrderQuantity(Math.max(1, adminOrderQuantity - 1))}
                        className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-50 transition-all active:scale-95"
                      >
                        <Minus className="w-4 h-4 text-zinc-600" />
                      </button>
                      <input 
                        type="number"
                        min="1"
                        value={adminOrderQuantity}
                        onChange={e => setAdminOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center bg-transparent font-bold font-display text-base border-none focus:outline-none"
                      />
                      <button 
                        type="button"
                        onClick={() => setAdminOrderQuantity(adminOrderQuantity + 1)}
                        className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-50 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4 text-zinc-600" />
                      </button>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600">付款狀態</label>
                    <div className="grid grid-cols-2 gap-2 h-[46px]">
                      <button
                        type="button"
                        onClick={() => setAdminOrderIsPaid(false)}
                        className={cn(
                          "rounded-xl text-xs font-bold transition-all border",
                          !adminOrderIsPaid 
                            ? "bg-zinc-800 text-white border-zinc-800 shadow-sm" 
                            : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                        )}
                      >
                        未付款
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminOrderIsPaid(true)}
                        className={cn(
                          "rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1",
                          adminOrderIsPaid 
                            ? "bg-green-600 text-white border-green-600 shadow-sm" 
                            : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已付款
                      </button>
                    </div>
                  </div>
                </div>

                {/* Total Price preview */}
                {(() => {
                  const targetPlan = plans.find(p => p.id === adminOrderPlanId);
                  const storeDishes = targetPlan ? dishes.filter(d => d.storeId === targetPlan.storeId) : [];
                  const dish = storeDishes.find(d => d.id === adminOrderDishId);
                  const price = (dish?.price || 0) * (adminOrderQuantity || 1);
                  return (
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between text-sm">
                      <span className="text-zinc-500 text-xs">小計金額預覽:</span>
                      <span className="font-bold text-orange-600 text-base">
                        ${price} <span className="text-xs text-zinc-400 font-normal">({dish?.name || '未選'} x {adminOrderQuantity})</span>
                      </span>
                    </div>
                  );
                })()}

                {/* Optional Notify Checkbox (only when creating new order) */}
                {!adminEditingOrder && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox"
                      checked={adminOrderNotify}
                      onChange={e => setAdminOrderNotify(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-zinc-300 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-600">同步發送下單通知至 Telegram / Line 群組</span>
                  </label>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-4 border-t border-zinc-100 mt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 py-2.5" 
                  onClick={() => setShowAdminOrderModal(false)}
                  disabled={adminOrderSaving}
                >
                  取消
                </Button>
                <Button 
                  className="flex-1 py-2.5 font-bold" 
                  onClick={handleSaveAdminOrder}
                  disabled={adminOrderSaving}
                >
                  {adminOrderSaving ? '儲存中...' : (adminEditingOrder ? '確認修改' : '確認新增 (補單)')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shortcut Modal */}
      <AnimatePresence>
        {showShortcutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setShowShortcutModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 flex flex-col max-h-[90vh] border border-zinc-100 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-zinc-100">
                <h3 className="text-2xl font-bold">桌面捷徑設置方式</h3>
                <button onClick={() => setShowShortcutModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                {/* iOS Section */}
                <div className="space-y-4">
                  <h4 className="font-bold text-lg">iphone /ipad</h4>
                  <div className="bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100">
                    <img src="/dt02.png" alt="iOS 捷徑設定" className="w-full object-contain max-h-64 bg-zinc-100" />
                  </div>
                  <div className="space-y-2 text-zinc-700">
                    <p className="font-medium">📱 簡易操作步驟</p>
                    <p>📱 1. 開啟網頁，點分享：用 Safari 打開網頁，點底部工具列中央的<strong>「分享」</strong>圖示（向上箭頭）。</p>
                    <p>👉 2. 找到「加入主畫面」：在彈出的選單中向上滑動，找到並點擊<strong>「加入主畫面」</strong>（帶有「+」號的圖示）。</p>
                    <p>✏️ 3. 命名 & 點新增：自訂你想要的名稱，然後點擊右上角的<strong>「新增」</strong>。</p>
                    <p>🎉 4. 完成！快速開啟：主畫面會出現一個新圖示，就像 App 一樣，點擊即可快速開啟該網頁。</p>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* Android Section */}
                <div className="space-y-4">
                  <h4 className="font-bold text-lg">安卓系統</h4>
                  <div className="bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100">
                    <img src="/dt01.png" alt="Android 捷徑設定" className="w-full object-contain max-h-64 bg-zinc-100" />
                  </div>
                  <div className="space-y-2 text-zinc-700">
                    <p className="font-medium">📱 Android 操作步驟文字版：</p>
                    <p>📱 1. 開啟網頁，點「更多」：用 Chrome 打開網頁，點網址列右側的<strong>「三個點」</strong>（更多）圖示。</p>
                    <p>👉 2. 找到「加到主畫面」：在選單中向下滑動，找到並點擊<strong>「加到主畫面」</strong>。</p>
                    <p>✏️ 3. 命名 & 點「新增」：自訂捷徑名稱，然後點擊<strong>「新增」</strong>。</p>
                    <p>🎉 4. 完成！快速開啟：主畫面會出現該網頁的捷徑圖示。</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
