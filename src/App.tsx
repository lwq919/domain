import React, { useEffect, useState, useRef } from 'react';
import {
  fetchDomains,
  saveDomains,
  deleteDomain,
  notifyExpiring,
  fetchNotificationSettingsFromServer,
  saveNotificationSettingsToServer,
  verifyAdminPassword
} from './api';
import { Domain, defaultDomain, SortOrder, ExportFormat, NotificationMethod } from './types';
import { 
  calculateProgress, 
  getDaysLeft, 
  exportToCSV, 
  downloadFile, 
  copyToClipboard, 
  getTodayString, 
  isMobile,
  parseCSVLine,
  normalizeField
} from './utils';

// 导入组件
import StatsGrid from './components/StatsGrid';
import DomainTable from './components/DomainTable';
import DomainModal from './components/DomainModal';
import ConfirmModal from './components/ConfirmModal';
import ExpireModal from './components/ExpireModal';
import InfoModal from './components/InfoModal';
import PasswordModal from './components/PasswordModal';

const App: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [showRegistrar, setShowRegistrar] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number>(-1);
  const [form, setForm] = useState<Domain>(defaultDomain);
  const [expireModal, setExpireModal] = useState(false);
  const [expiringDomains, setExpiringDomains] = useState<Domain[]>([]);
  const [deleteModal, setDeleteModal] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'delete' | 'batchDelete' | null>(null);
  const [infoModal, setInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoTitle, setInfoTitle] = useState('');

  // 通知相关状态
  const [warningDays, setWarningDays] = useState(() => localStorage.getItem('notificationWarningDays') || '15');
  const [notificationEnabled, setNotificationEnabled] = useState(() => localStorage.getItem('notificationEnabled') || 'true');
  const [notificationInterval, setNotificationInterval] = useState(() => localStorage.getItem('notificationInterval') || 'daily');
  const [notificationMethods, setNotificationMethods] = useState<NotificationMethod[]>([]);
  const [dontRemindToday, setDontRemindToday] = useState(() => {
    const dontRemindDate = localStorage.getItem('dontRemindToday');
    return dontRemindDate === getTodayString();
  });
  const [notificationSentToday, setNotificationSentToday] = useState(() => {
    const lastNotificationDate = localStorage.getItem('lastNotificationDate');
    return lastNotificationDate === getTodayString();
  });

  // 背景图片相关状态
  const [bgImageUrl, setBgImageUrl] = useState(() => localStorage.getItem('customBgImageUrl') || '');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselInterval, setCarouselInterval] = useState(() => {
    const val = localStorage.getItem('carouselInterval');
    return val ? Number(val) : 30;
  });
  const carouselIndex = useRef(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 操作消息
  const [opMsg, setOpMsg] = useState('');
  useEffect(() => {
    if (opMsg) {
      const t = setTimeout(() => setOpMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [opMsg]);

  // 初始化
  useEffect(() => {
    loadDomains();
    loadCarouselImages();
    loadNotificationSettings();
  }, []);

  // 每天开始时重置通知状态
  useEffect(() => {
    const lastNotificationDate = localStorage.getItem('lastNotificationDate');
    if (lastNotificationDate !== getTodayString()) {
      setNotificationSentToday(false);
    }
    
    const dontRemindDate = localStorage.getItem('dontRemindToday');
    const shouldDontRemind = dontRemindDate === getTodayString();
    setDontRemindToday(shouldDontRemind);
  }, []);

  // 背景图片轮播
  useEffect(() => {
    if (bgImageUrl && bgImageUrl.trim() !== '') {
      document.body.style.backgroundImage = `url('${bgImageUrl}')`;
      if (carouselTimer.current) clearInterval(carouselTimer.current);
      return;
    }
    if (carouselImages.length === 0) return;
    
    function setBg(idx: number) {
      const url = `/image/${carouselImages[idx]}`;
      document.body.style.backgroundImage = `url('${url}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundPosition = 'center center';
    }
    
    setBg(carouselIndex.current);
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    carouselTimer.current = setInterval(() => {
      carouselIndex.current = (carouselIndex.current + 1) % carouselImages.length;
      setBg(carouselIndex.current);
    }, carouselInterval * 1000);
    
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [bgImageUrl, carouselImages, carouselInterval]);

  // 检查到期域名
  useEffect(() => {
    if (!dontRemindToday && domains.length > 0) {
      checkExpiringDomains(domains).catch(error => {
        console.error('检查到期域名时出错:', error);
      });
    }
  }, [dontRemindToday, domains]);

  // 数据加载函数
  async function loadDomains() {
    setLoading(true);
    try {
      const data = await fetchDomains();
      setDomains(data);
      if (!dontRemindToday) {
        checkExpiringDomains(data).catch(error => {
          console.error('检查到期域名时出错:', error);
        });
      }
    } catch (error) {
      setOpMsg('加载域名失败');
      console.error('加载域名失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotificationSettings() {
    try {
      const data = await fetchNotificationSettingsFromServer();
      if (data.success && data.settings) {
        setWarningDays(data.settings.warningDays);
        setNotificationEnabled(data.settings.notificationEnabled);
        setNotificationInterval(data.settings.notificationInterval);
        let methods = data.settings.notificationMethod;
        if (Array.isArray(methods)) setNotificationMethods(methods);
        else if (typeof methods === 'string') {
          try { setNotificationMethods(JSON.parse(methods)); } catch { setNotificationMethods([]); }
        } else setNotificationMethods([]);
      }
    } catch (error) {
      console.error('加载通知设置失败:', error);
    }
  }

  function loadCarouselImages() {
    fetch('/image/images.json')
      .then(res => res.text())
      .then(txt => {
        let data: string[] = [];
        try { data = JSON.parse(txt); } catch {}
        if (!Array.isArray(data) || data.length === 0) data = ["background.jpeg"];
        setCarouselImages(data);
      })
      .catch(() => setCarouselImages(["background.jpeg"]));
  }

  // 到期域名检查
  async function checkExpiringDomains(domains: Domain[]) {
    if (dontRemindToday) return;
    
    try {
      const settingsData = await fetchNotificationSettingsFromServer();
      if (!settingsData.success || !settingsData.settings) return;
      
      const settings = settingsData.settings;
      const notificationEnabled = settings.notificationEnabled === 'true';
      if (!notificationEnabled) return;
      
      const warningDays = parseInt(settings.warningDays || '15', 10);
      const today = new Date();
      const warningDate = new Date(today.getTime() + warningDays * 24 * 60 * 60 * 1000);
      const expiring = domains.filter(domain => {
        const expire_date = new Date(domain.expire_date);
        return expire_date <= warningDate && expire_date >= today;
      });
      
      setExpiringDomains(expiring);
      if (expiring.length > 0) {
        setExpireModal(true);
        
        if (!notificationSentToday) {
          await notifyExpiring(expiring);
          localStorage.setItem('lastNotificationDate', getTodayString());
          setNotificationSentToday(true);
        }
      }
    } catch (error) {
      console.error('检查到期域名时出错:', error);
    }
  }

  // 表格操作函数
  function handleSort(field: string) {
    setSortField(field);
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIndexes(domains.map((_: Domain, idx: number) => idx));
    } else {
      setSelectedIndexes([]);
    }
  }

  function handleSelectRow(index: number, checked: boolean) {
    setSelectedIndexes(prev => checked ? [...prev, index] : prev.filter(i => i !== index));
  }

  function handleEdit(index: number) {
    setEditIndex(index);
    setForm(domains[index]);
    setModalOpen(true);
  }

  function handleDelete(index: number) {
    setDomainToDelete(domains[index]);
    setPasswordAction('delete');
    setPasswordModal(true);
  }

  function handleRenew(domain: Domain) {
    if (domain.renewUrl && domain.renewUrl.trim() !== '') {
      window.open(domain.renewUrl, '_blank');
    } else {
      showInfoModal('续期提示', `请联系注册商 ${domain.registrar} 对域名 ${domain.domain} 进行续期操作。`);
    }
  }

  function handleCopy(domain: string) {
    copyToClipboard(domain).then(() => {
      setOpMsg('域名已复制到剪贴板');
    });
  }

  function handleBatchOperation(operation: string) {
    if (operation === 'expired') handleBatchSetStatus('expired');
    else if (operation === 'active') handleBatchSetStatus('active');
    else if (operation === 'delete') handleBatchDelete();
  }

  // 批量操作
  async function handleBatchSetStatus(status: string) {
    if (selectedIndexes.length === 0) {
      showInfoModal('提示', '请先选择要操作的域名');
      return;
    }
    
    const validStatus = (status: string): 'active' | 'expired' | 'pending' => {
      if (status === 'active' || status === 'expired' || status === 'pending') return status;
      return 'pending';
    };
    
    const domainsToUpdate = selectedIndexes.map(idx => domains[idx]);
    const newDomains = domains.map(d => {
      const domainToUpdate = domainsToUpdate.find(updateDomain => updateDomain.domain === d.domain);
      return domainToUpdate ? { ...d, status: validStatus(status) } : d;
    });
    
    await saveDomains(newDomains);
    setSelectedIndexes([]);
    await loadDomains();
    setOpMsg('批量状态修改成功');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleBatchDelete() {
    if (selectedIndexes.length === 0) {
      showInfoModal('提示', '请先选择要删除的域名');
      return;
    }
    setPasswordAction('batchDelete');
    setPasswordModal(true);
  }

  async function confirmBatchDelete() {
    const domainsToDelete = selectedIndexes.map(idx => domains[idx]);
    const newDomains = domains.filter(domain => !domainsToDelete.some(d => d.domain === domain.domain));
    await saveDomains(newDomains);
    setSelectedIndexes([]);
    await loadDomains();
    setOpMsg('批量删除成功');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setBatchDeleteModal(false);
  }

  // 模态框操作
  function handleAdd() {
    setEditIndex(-1);
    setForm(defaultDomain);
    setModalOpen(true);
  }

  async function handleFormSubmit(domain: Domain) {
    let newDomains = [...domains];
    if (editIndex >= 0) {
      newDomains[editIndex] = domain;
    } else {
      newDomains.push(domain);
    }
    await saveDomains(newDomains);
    setModalOpen(false);
    setEditIndex(-1);
    setForm(defaultDomain);
    await loadDomains();
    setOpMsg('保存成功');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleFormChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handlePasswordConfirm(password: string) {
    try {
      const isValid = await verifyAdminPassword(password);
      
      if (!isValid) {
        showInfoModal('密码错误', '管理员密码不正确，请重试');
        return;
      }
      
      // 密码验证成功，执行相应的删除操作
      if (passwordAction === 'delete' && domainToDelete) {
        await deleteDomain(domainToDelete.domain);
        await loadDomains();
        setOpMsg('域名删除成功');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setDomainToDelete(null);
      } else if (passwordAction === 'batchDelete') {
        setBatchDeleteModal(true);
      }
      
      setPasswordModal(false);
      setPasswordAction(null);
      
    } catch (error) {
      console.error('密码验证失败:', error);
      showInfoModal('验证失败', '密码验证过程中发生错误，请重试');
    }
  }

  function handlePasswordCancel() {
    setPasswordModal(false);
    setPasswordAction(null);
    setDomainToDelete(null);
  }

  async function confirmDelete() {
    if (domainToDelete) {
      await deleteDomain(domainToDelete.domain);
      await loadDomains();
      setOpMsg('域名删除成功');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setDeleteModal(false);
    setDomainToDelete(null);
  }

  function handleCloseExpireModal(dontRemind: boolean) {
    setExpireModal(false);
    if (dontRemind) {
      localStorage.setItem('dontRemindToday', getTodayString());
      setDontRemindToday(true);
    }
    if (!notificationSentToday) {
      localStorage.setItem('lastNotificationDate', getTodayString());
      setNotificationSentToday(true);
    }
  }

  function showInfoModal(title: string, message: string) {
    setInfoTitle(title);
    setInfoMessage(message);
    setInfoModal(true);
  }

  // 导出导入功能
  function handleExport(format: ExportFormat) {
    if (!domains || domains.length === 0) {
      setOpMsg('暂无域名数据可导出');
      return;
    }
    
    try {
      if (format === 'csv' || format === 'txt') {
        const content = exportToCSV(domains);
        downloadFile(content, `domains.${format}`, format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;');
      } else if (format === 'json') {
        const content = JSON.stringify(domains, null, 2);
        downloadFile(content, 'domains.json', 'application/json');
      }
      setOpMsg('导出成功');
    } catch {
      setOpMsg('导出失败');
    }
  }

  // 全局操作消息组件
  const GlobalOpMsg = opMsg ? (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(40,40,40,0.45)',
      color: '#fff',
      fontSize: 18,
      fontWeight: 600,
      padding: '12px 32px',
      borderRadius: 16,
      zIndex: 99999,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      pointerEvents: 'none',
      textAlign: 'center',
      letterSpacing: 1.2,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      minWidth: 180,
      maxWidth: '80vw',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>{opMsg}</div>
  ) : null;

  return (
    <div className="container" style={{ maxWidth: 1300, margin: '0 auto', padding: 20, position: 'relative', zIndex: 1 }}>
      {GlobalOpMsg}
      
      <div className="header">
        <h1>域名面板</h1>
        <p>查看域名状态、注册商、注册日期、过期日期和使用进度</p>
        <button className="settings-btn" onClick={() => {/* 设置按钮逻辑 */}}>⚙️</button>
      </div>

      <StatsGrid domains={domains} />

      <DomainTable
        domains={domains}
        loading={loading}
        search={search}
        sortField={sortField}
        sortOrder={sortOrder}
        selectedIndexes={selectedIndexes}
        showRegistrar={showRegistrar}
        showProgress={showProgress}
        page={page}
        pageSize={pageSize}
        onSort={handleSort}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRenew={handleRenew}
        onCopy={handleCopy}
        onBatchOperation={handleBatchOperation}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
      />

      <button className="add-domain-btn" onClick={handleAdd}>+</button>

      {/* 模态框组件 */}
      <DomainModal
        isOpen={modalOpen}
        isEdit={editIndex >= 0}
        domain={form}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        onChange={handleFormChange}
      />

      <ConfirmModal
        isOpen={deleteModal}
        title="🗑️ 删除确认"
        message="确定要删除以下域名吗？此操作不可撤销："
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal(false)}
        domains={domainToDelete ? [domainToDelete] : []}
        showDomainList={true}
      />

      <ConfirmModal
        isOpen={batchDeleteModal}
        title="🗑️ 批量删除确认"
        message={`确定要批量删除选中的 ${selectedIndexes.length} 个域名吗？此操作不可撤销：`}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmBatchDelete}
        onCancel={() => setBatchDeleteModal(false)}
        domains={selectedIndexes.map(idx => domains[idx])}
        showDomainList={true}
      />

      <ExpireModal
        isOpen={expireModal}
        expiringDomains={expiringDomains}
        onClose={handleCloseExpireModal}
      />

      <InfoModal
        isOpen={infoModal}
        title={infoTitle}
        message={infoMessage}
        onClose={() => setInfoModal(false)}
      />

      <PasswordModal
        isOpen={passwordModal}
        title="🔐 管理员验证"
        message={passwordAction === 'delete' && domainToDelete 
          ? `确定要删除域名 "${domainToDelete.domain}" 吗？此操作需要管理员权限。`
          : `确定要批量删除选中的 ${selectedIndexes.length} 个域名吗？此操作需要管理员权限。`
        }
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
        confirmText="验证并删除"
        cancelText="取消"
      />
    </div>
  );
};

export default App; 
