import React, { useEffect, useState, useRef } from 'react';
import {
  fetchDomains,
  saveDomains,
  deleteDomain,
  notifyExpiring,
  fetchNotificationSettingsFromServer,
  saveNotificationSettingsToServer,
  verifyAdminPassword,
  webdavBackup,
  webdavRestore
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
import SettingsModal from './components/SettingsModal';
import LogsModal from './components/LogsModal';

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
  const [domainToRenew, setDomainToRenew] = useState<Domain | null>(null);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'delete' | 'batchDelete' | 'edit' | 'renew' | null>(null);
  const [infoModal, setInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [settingsModal, setSettingsModal] = useState(false);
  const [logsModal, setLogsModal] = useState(false);

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
      if (carouselTimer.current) {
        clearInterval(carouselTimer.current);
        carouselTimer.current = null;
      }
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
    if (carouselTimer.current) {
      clearInterval(carouselTimer.current);
      carouselTimer.current = null;
    }
    carouselTimer.current = setInterval(() => {
      carouselIndex.current = (carouselIndex.current + 1) % carouselImages.length;
      setBg(carouselIndex.current);
    }, carouselInterval * 1000);
    
    return () => {
      if (carouselTimer.current) {
        clearInterval(carouselTimer.current);
        carouselTimer.current = null;
      }
    };
  }, [bgImageUrl, carouselImages, carouselInterval]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (carouselTimer.current) {
        clearInterval(carouselTimer.current);
        carouselTimer.current = null;
      }
    };
  }, []);

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
    } catch (error: any) {
      const errorMessage = error.message || '加载域名失败';
      setOpMsg(`加载失败: ${errorMessage}`);
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
    } catch (error: any) {
      console.error('加载通知设置失败:', error);
      // 静默失败，不影响主要功能
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
    } catch (error: any) {
      console.error('检查到期域名时出错:', error);
      // 静默失败，不影响主要功能
    }
  }

  // 表格操作函数
  function handleSort(field: string) {
    setSortField(field);
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      // 获取当前页面的域名索引
      const filteredDomains = domains.filter((domain: Domain) =>
        domain.domain.toLowerCase().includes(search.toLowerCase()) ||
        domain.registrar.toLowerCase().includes(search.toLowerCase()) ||
        domain.status.toLowerCase().includes(search.toLowerCase())
      );
      
      // 对过滤后的域名进行排序
      let sortedDomains = [...filteredDomains];
      if (sortField) {
        sortedDomains = sortedDomains.sort((a: Domain, b: Domain) => {
          let valA: any = a[sortField as keyof Domain];
          let valB: any = b[sortField as keyof Domain];
          if (sortField === 'daysLeft') {
            valA = getDaysLeft(a.expire_date);
            valB = getDaysLeft(b.expire_date);
          }
          if (sortField === 'progress') {
            valA = calculateProgress(a.register_date, a.expire_date);
            valB = calculateProgress(b.register_date, b.expire_date);
          }
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      } else {
        sortedDomains = sortedDomains.sort((a: Domain, b: Domain) => new Date(a.expire_date).getTime() - new Date(b.expire_date).getTime());
      }
      
      // 获取当前页面的域名
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const currentPageDomains = sortedDomains.slice(startIndex, endIndex);
      
      // 获取这些域名在原始数组中的索引
      const currentPageIndexes = currentPageDomains.map(domain => domains.findIndex((d: Domain) => d.domain === domain.domain));
      setSelectedIndexes(currentPageIndexes);
    } else {
      setSelectedIndexes([]);
    }
  }

  function handleSelectRow(index: number, checked: boolean) {
    setSelectedIndexes((prev: number[]) => checked ? [...prev, index] : prev.filter((i: number) => i !== index));
  }

  function handleEdit(index: number) {
    setEditIndex(index);
    setForm(domains[index]);
    setPasswordAction('edit');
    setPasswordModal(true);
  }

  function handleDelete(index: number) {
    setDomainToDelete(domains[index]);
    setPasswordAction('delete');
    setPasswordModal(true);
  }

  function handleRenew(domain: Domain) {
    setDomainToRenew(domain);
    setPasswordAction('renew');
    setPasswordModal(true);
  }

  function performRenew(domain: Domain) {
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
    
    const domainsToUpdate = selectedIndexes.map((idx: number) => domains[idx]);
    const newDomains = domains.map((d: Domain) => {
      const domainToUpdate = domainsToUpdate.find((updateDomain: Domain) => updateDomain.domain === d.domain);
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
    const domainsToDelete = selectedIndexes.map((idx: number) => domains[idx]);
    const newDomains = domains.filter((domain: Domain) => !domainsToDelete.some((d: Domain) => d.domain === domain.domain));
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
    setForm((prev: Domain) => ({ ...prev, [field]: value }));
  }

  async function handlePasswordConfirm(password: string) {
    try {
      const isValid = await verifyAdminPassword(password);
      
      if (!isValid) {
        showInfoModal('密码错误', '管理员密码不正确，请重试');
        return;
      }
      
      // 密码验证成功，执行相应的操作
      if (passwordAction === 'delete' && domainToDelete) {
        await deleteDomain(domainToDelete.domain);
        await loadDomains();
        setOpMsg('域名删除成功');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setDomainToDelete(null);
      } else if (passwordAction === 'batchDelete') {
        setBatchDeleteModal(true);
      } else if (passwordAction === 'edit') {
        setModalOpen(true);
      } else if (passwordAction === 'renew' && domainToRenew) {
        performRenew(domainToRenew);
        setDomainToRenew(null);
      }
      
      setPasswordModal(false);
      setPasswordAction(null);
      
    } catch (error: any) {
      console.error('密码验证失败:', error);
      const errorMessage = error.message || '密码验证过程中发生错误';
      showInfoModal('验证失败', `请重试: ${errorMessage}`);
    }
  }

  function handlePasswordCancel() {
    const currentAction = passwordAction;
    setPasswordModal(false);
    setPasswordAction(null);
    setDomainToDelete(null);
    setDomainToRenew(null);
    if (currentAction === 'edit') {
      setEditIndex(-1);
      setForm(defaultDomain);
    }
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

  // 处理域名数据导入
  async function handleImportDomains(importedDomains: Domain[]) {
    try {
      await saveDomains(importedDomains);
      setDomains(importedDomains);
      showInfoModal('✅ 导入成功', `成功导入 ${importedDomains.length} 个域名`);
    } catch (error) {
      showInfoModal('❌ 导入失败', error instanceof Error ? error.message : '导入失败');
    }
  }

  async function handleSettingsSave(settings: {
    warningDays: string;
    notificationEnabled: string;
    notificationInterval: string;
    notificationMethods: NotificationMethod[];
    bgImageUrl: string;
    carouselInterval: number;
  }) {
    try {
      // 保存通知设置到服务器
      await saveNotificationSettingsToServer({
        warningDays: settings.warningDays,
        notificationEnabled: settings.notificationEnabled,
        notificationInterval: settings.notificationInterval,
        notificationMethod: JSON.stringify(settings.notificationMethods)
      });

      // 更新本地状态
      setWarningDays(settings.warningDays);
      setNotificationEnabled(settings.notificationEnabled);
      setNotificationInterval(settings.notificationInterval);
      setNotificationMethods(settings.notificationMethods);
      setBgImageUrl(settings.bgImageUrl);
      setCarouselInterval(settings.carouselInterval);

      // 保存到本地存储
      localStorage.setItem('notificationWarningDays', settings.warningDays);
      localStorage.setItem('notificationEnabled', settings.notificationEnabled);
      localStorage.setItem('notificationInterval', settings.notificationInterval);
      localStorage.setItem('customBgImageUrl', settings.bgImageUrl);
      localStorage.setItem('carouselInterval', settings.carouselInterval.toString());

      setOpMsg('设置保存成功');
    } catch (error: any) {
      console.error('保存设置失败:', error);
      const errorMessage = error.message || '保存设置时发生错误';
      showInfoModal('保存失败', `请重试: ${errorMessage}`);
    }
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

  // WebDAV备份功能
  async function handleWebDAVBackup() {
    try {
      const result = await webdavBackup({});
      showInfoModal('✅ WebDAV备份成功', `成功备份 ${result.domainsCount || 0} 个域名到 ${result.filename || 'WebDAV服务器'}`);
      setOpMsg('WebDAV备份成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '备份失败';
      showInfoModal('❌ WebDAV备份失败', errorMessage);
      throw error;
    }
  }

  // WebDAV恢复功能
  async function handleWebDAVRestore() {
    try {
      const result = await webdavRestore({});
      // 重新加载域名数据
      await loadDomains();
      showInfoModal('✅ WebDAV恢复成功', `成功恢复 ${result.domainsCount || 0} 个域名，备份时间: ${result.timestamp || '未知'}`);
      setOpMsg('WebDAV恢复成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '恢复失败';
      showInfoModal('❌ WebDAV恢复失败', errorMessage);
      throw error;
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
        <button className="settings-btn" onClick={() => setSettingsModal(true)}>⚙️</button>
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
        message={
          passwordAction === 'delete' && domainToDelete 
            ? `确定要删除域名 "${domainToDelete.domain}" 吗？此操作需要管理员权限。`
            : passwordAction === 'edit'
            ? `确定要编辑域名 "${form.domain}" 吗？此操作需要管理员权限。`
            : passwordAction === 'renew' && domainToRenew
            ? `确定要续期域名 "${domainToRenew.domain}" 吗？此操作需要管理员权限。`
            : `确定要批量删除选中的 ${selectedIndexes.length} 个域名吗？此操作需要管理员权限。`
        }
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
        confirmText={
          passwordAction === 'edit' ? '验证并编辑' 
          : passwordAction === 'renew' ? '验证并续期'
          : '验证并删除'
        }
        cancelText="取消"
      />

      <SettingsModal
        isOpen={settingsModal}
        onClose={() => setSettingsModal(false)}
        warningDays={warningDays}
        notificationEnabled={notificationEnabled}
        notificationInterval={notificationInterval}
        notificationMethods={notificationMethods}
        bgImageUrl={bgImageUrl}
        carouselInterval={carouselInterval}
        domains={domains}
        onSave={handleSettingsSave}
        onImportDomains={handleImportDomains}
        onWebDAVBackup={handleWebDAVBackup}
        onWebDAVRestore={handleWebDAVRestore}
        onOpenLogs={() => setLogsModal(true)}
      />

      <LogsModal
        isOpen={logsModal}
        onClose={() => setLogsModal(false)}
      />

    </div>
  );
};

export default App; 
