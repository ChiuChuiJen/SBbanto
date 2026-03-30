import React, { useState, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
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
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
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
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import { APP_VERSION } from './constants';

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
    primary: 'bg-orange-600 text-white hover:bg-orange-700',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-900',
    outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2',
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
  className
}: { 
  label?: string; 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  type?: string;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && <label className="text-sm font-medium text-zinc-600">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
    />
  </div>
);

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div {...props} className={cn("bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden", className)}>
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
      : `權限不足：請先登入 Google 帳號，或確認您輸入的姓名/代號與原訂單一致。`;
    alert(userMsg);
  }
  throw new Error(JSON.stringify(errInfo));
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

function AppContent() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [language, setLanguage] = useState<'zh' | 'en' | 'vi'>('zh');
  const [darkMode, setDarkMode] = useState(false);

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
  const [stores, setStores] = useState<Store[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ col: string, id: string } | null>(null);

  // User State
  const [userTab, setUserTab] = useState<'plans' | 'all-orders'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [userName, setUserName] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Admin State
  const [adminTab, setAdminTab] = useState<'plans' | 'stores' | 'dishes' | 'orders' | 'announcement'>('plans');
  const [newStore, setNewStore] = useState({ name: '', description: '' });
  const [newDish, setNewDish] = useState({ storeId: '', name: '', price: '', category: '' });
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [bulkDishInput, setBulkDishInput] = useState('');
  const [newPlan, setNewPlan] = useState({ name: '', storeId: '', diningDate: '', closingTime: '' });
  const [announcementEdit, setAnnouncementEdit] = useState({ content: '', isActive: false });

  const isAdmin = user?.email?.toLowerCase() === 'chiuchuijen@gmail.com';

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

    return () => {
      unsubscribeAuth();
      unsubStores();
      unsubDishes();
      unsubPlans();
      unsubOrders();
      unsubAnnounce();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

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

  const addStore = async () => {
    if (!newStore.name) return;
    const storeRef = doc(collection(db, 'stores'));
    const id = storeRef.id;
    try {
      await setDoc(storeRef, { id, ...newStore });
      setNewStore({ name: '', description: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'stores');
    }
  };

  const addDish = async () => {
    const price = parseFloat(newDish.price);
    if (!newDish.name || !newDish.storeId || isNaN(price) || price < 0) return;
    
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
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'dishes');
    }
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
      setNewPlan({ name: '', storeId: '', diningDate: '', closingTime: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'plans');
    }
  };

  const deleteItem = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
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
    <div className={cn("min-h-screen transition-colors duration-300", darkMode ? "bg-zinc-900 text-zinc-100 dark" : "bg-zinc-50 text-zinc-900")}>
      {/* Header */}
      <header className={cn("border-b sticky top-0 z-10 transition-colors duration-300", darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('user')}>
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">{t('title')}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Theme & Language Switchers */}
            <div className="flex items-center gap-2 mr-2">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={darkMode ? "Light Mode" : "Dark Mode"}
              >
                {darkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4 text-zinc-500" />}
              </button>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-xs font-bold border-none focus:ring-0 cursor-pointer"
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
                    className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-orange-600 transition-colors"
                  >
                    {view === 'user' ? (
                      <><Settings className="w-4 h-4" /> {t('adminBackend')}</>
                    ) : (
                      <><ArrowLeft className="w-4 h-4" /> {t('backToFront')}</>
                    )}
                  </button>
                )}
                <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold">{user.displayName}</div>
                    <div className="text-[10px] text-zinc-400">{user.email}</div>
                  </div>
                  <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-zinc-100 dark:border-zinc-800" alt="" />
                  <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><LogOut className="w-4 h-4" /></button>
                </div>
              </>
            ) : (
              <Button onClick={handleLogin} variant="outline" className="text-sm">
                <LogIn className="w-4 h-4" /> {t('login')}
              </Button>
            )}
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
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setUserTab('plans')}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                    userTab === 'plans' ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  {t('plans')}
                </button>
                <button
                  onClick={() => setUserTab('all-orders')}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                    userTab === 'all-orders' ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  {t('orders')}
                </button>
              </div>
            )}

            {/* User View Content */}
            {userTab === 'plans' ? (
              !selectedPlan ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold">{t('activePlans')}</h2>
                    <p className="text-zinc-500">{t('selectPlan')}</p>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plans.filter(p => isAfter(parseISO(p.closingTime), new Date())).map(plan => {
                    const store = stores.find(s => s.id === plan.storeId);
                    return (
                      <motion.div 
                        key={plan.id}
                        whileHover={{ y: -4 }}
                        onClick={() => setSelectedPlan(plan)}
                        className="cursor-pointer"
                      >
                        <Card className="p-6 hover:border-orange-200 transition-colors group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <h3 className="font-bold text-xl group-hover:text-orange-600 transition-colors">{plan.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <Store className="w-4 h-4" />
                                <span>{store?.name || '未知店家'}</span>
                              </div>
                            </div>
                            <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                              進行中
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50">
                            <div className="space-y-1">
                              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">用餐日期</div>
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Calendar className="w-4 h-4 text-zinc-400" />
                                {plan.diningDate}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">截止時間</div>
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Clock className="w-4 h-4 text-zinc-400" />
                                {format(parseISO(plan.closingTime), 'MM/dd HH:mm')}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {plans.filter(p => isAfter(parseISO(p.closingTime), new Date())).length === 0 && (
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
                          className="space-y-8 pt-8 border-t border-zinc-100"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                              <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">2</span>
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
                                            "p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center",
                                            selectedDish?.id === dish.id 
                                              ? "border-orange-500 bg-orange-50/30" 
                                              : "border-zinc-100 hover:border-zinc-200"
                                          )}
                                        >
                                          <div className="font-bold">{dish.name}</div>
                                          <div className="text-orange-600 font-bold">${dish.price}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                              <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">3</span>
                              數量
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                              >
                                -
                              </button>
                              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                              <button 
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-10 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                              >
                                +
                              </button>
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

                <div className="space-y-8">
                  {plans.sort((a, b) => b.diningDate.localeCompare(a.diningDate)).map(plan => {
                    const planOrders = orders.filter(o => o.planId === plan.id);
                    if (planOrders.length === 0) return null;
                    const store = stores.find(s => s.id === plan.storeId);
                    const total = planOrders.reduce((acc, o) => {
                      const dish = dishes.find(d => d.id === o.dishId);
                      return acc + (dish?.price || 0) * o.quantity;
                    }, 0);

                    return (
                      <Card key={plan.id} className="overflow-hidden">
                        <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-lg">{plan.name}</h3>
                            <div className="text-xs text-zinc-500 flex items-center gap-2">
                              <Store className="w-3 h-3" /> {store?.name} | <Calendar className="w-3 h-3" /> {plan.diningDate}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-zinc-400">總金額</div>
                            <div className="text-lg font-bold text-orange-600">${total}</div>
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
                              {planOrders.map(order => {
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
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  })}
                  {orders.length === 0 && (
                    <div className="py-20 text-center text-zinc-400">目前沒有任何訂單</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Admin View */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">管理後台</h2>
                <p className="text-zinc-500">管理店家、菜色與團購方案</p>
              </div>
              <div className="flex bg-white p-1 rounded-lg border border-zinc-200">
                {(['plans', 'stores', 'dishes', 'orders', 'announcement'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminTab(tab)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                      adminTab === tab ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    {tab === 'plans' && '方案'}
                    {tab === 'stores' && '店家'}
                    {tab === 'dishes' && '菜色'}
                    {tab === 'orders' && '訂單'}
                    {tab === 'announcement' && '公告'}
                  </button>
                ))}
              </div>
            </div>

            <Card className="p-6">
              {adminTab === 'plans' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-zinc-50 p-4 rounded-xl">
                    <Input label="方案名稱" value={newPlan.name} onChange={v => setNewPlan({...newPlan, name: v})} placeholder="例如：週三午餐團" />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-zinc-600">綁定店家</label>
                      <select 
                        value={newPlan.storeId} 
                        onChange={e => setNewPlan({...newPlan, storeId: e.target.value})}
                        className="px-4 py-2 rounded-lg border border-zinc-200 bg-white"
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
                          <th className="py-3 px-4 font-bold">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {plans.map(plan => (
                          <tr key={plan.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-4 px-4 font-bold">{plan.name}</td>
                            <td className="py-4 px-4 text-zinc-600">{stores.find(s => s.id === plan.storeId)?.name}</td>
                            <td className="py-4 px-4 text-zinc-600">{plan.diningDate}</td>
                            <td className="py-4 px-4 text-zinc-600">{format(parseISO(plan.closingTime), 'yyyy/MM/dd HH:mm')}</td>
                            <td className="py-4 px-4">
                              <button onClick={() => setConfirmDelete({ col: 'plans', id: plan.id })} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'stores' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-zinc-50 p-4 rounded-xl">
                    <Input label="店家名稱" value={newStore.name} onChange={v => setNewStore({...newStore, name: v})} placeholder="例如：老王便當" />
                    <Input label="店家描述" value={newStore.description} onChange={v => setNewStore({...newStore, description: v})} placeholder="例如：排骨飯很好吃" />
                    <Button onClick={addStore}><Plus className="w-4 h-4 inline mr-2" /> 新增店家</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stores.map(store => (
                      <div key={store.id} className="p-4 rounded-xl border border-zinc-100 flex justify-between items-center">
                        <div>
                          <div className="font-bold">{store.name}</div>
                          <div className="text-sm text-zinc-500">{store.description}</div>
                        </div>
                        <button onClick={() => setConfirmDelete({ col: 'stores', id: store.id })} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'dishes' && (
                <div className="space-y-8">
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
                    {stores.map(store => {
                      const storeDishes = dishes.filter(d => d.storeId === store.id);
                      if (storeDishes.length === 0) return null;
                      
                      // Group by category
                      const categories = Array.from(new Set(storeDishes.map(d => d.category || '未分類')));

                      return (
                        <div key={store.id} className="space-y-4">
                          <div className="flex items-center gap-3 pb-2 border-b border-zinc-100">
                            <Store className="w-5 h-5 text-orange-600" />
                            <h3 className="text-lg font-bold">{store.name}</h3>
                            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{storeDishes.length} 筆菜色</span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-6">
                            {categories.map(cat => (
                              <div key={cat} className="space-y-2 pl-4 border-l-2 border-zinc-100">
                                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{cat}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {storeDishes.filter(d => (d.category || '未分類') === cat).map(dish => (
                                    <div key={dish.id} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-800 hover:border-zinc-200 transition-all shadow-sm">
                                      <div>
                                        <div className="font-bold text-sm">{dish.name}</div>
                                        <div className="text-orange-600 font-bold text-xs">${dish.price}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => startEditDish(dish)}
                                          className="p-2 text-zinc-300 hover:text-orange-600 transition-colors"
                                          title={t('edit')}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => setConfirmDelete({ col: 'dishes', id: dish.id })} 
                                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {adminTab === 'orders' && (
                <div className="space-y-10">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">訂單管理</h3>
                    <div className="text-sm text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">共 {orders.length} 筆訂單</div>
                  </div>

                  {plans.map(plan => {
                    const planOrders = orders.filter(o => o.planId === plan.id);
                    if (planOrders.length === 0) return null;

                    // Calculate dish summary for this plan
                    const dishSummary: { [dishId: string]: { name: string, count: number } } = {};
                    planOrders.forEach(order => {
                      if (!dishSummary[order.dishId]) {
                        const dish = dishes.find(d => d.id === order.dishId);
                        dishSummary[order.dishId] = { name: dish?.name || '未知菜色', count: 0 };
                      }
                      dishSummary[order.dishId].count += order.quantity;
                    });

                    return (
                      <div key={plan.id} className="space-y-6 border-l-4 border-orange-500 pl-6 py-2">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="text-xl font-bold text-zinc-900">{plan.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-zinc-500">
                              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {plan.diningDate}</span>
                              <span className="flex items-center gap-1"><Store className="w-4 h-4" /> {stores.find(s => s.id === plan.storeId)?.name}</span>
                            </div>
                          </div>
                          
                          {/* Dish Summary Cards */}
                          <div className="flex flex-wrap gap-2">
                            {Object.values(dishSummary).map((item, idx) => (
                              <div key={idx} className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-orange-100 flex items-center gap-2">
                                <span>{item.name}</span>
                                <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded text-[10px] min-w-[20px] text-center">{item.count}</span>
                              </div>
                            ))}
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
                              {planOrders.map(order => {
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
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => startEditOrder(order)} className="text-zinc-400 hover:text-orange-600"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => setConfirmDelete({ col: 'orders', id: order.id })} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}

                  {orders.length === 0 && (
                    <div className="py-20 text-center text-zinc-400">目前沒有任何訂單紀錄</div>
                  )}
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
            </Card>
          </div>
        )}
      </main>

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
              className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="text-xl font-bold">系統公告</h3>
                </div>
                <button 
                  onClick={() => setShowAnnouncement(false)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="text-zinc-600 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                {announcement.content}
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-end">
                <Button onClick={() => setShowAnnouncement(false)}>我知道了</Button>
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
              className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 space-y-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">確認刪除？</h3>
                <p className="text-zinc-500 text-sm">此操作無法復原，確定要刪除這筆資料嗎？</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setConfirmDelete(null)}
                >
                  取消
                </Button>
                <Button 
                  variant="danger" 
                  className="flex-1" 
                  onClick={() => deleteItem(confirmDelete.col, confirmDelete.id)}
                >
                  刪除
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Version Number */}
      <div className="fixed bottom-4 right-4 text-[10px] font-mono text-zinc-400 bg-white/50 backdrop-blur-sm px-2 py-1 rounded-md border border-zinc-100 pointer-events-none">
        {APP_VERSION}
      </div>
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
