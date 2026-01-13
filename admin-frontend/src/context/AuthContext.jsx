import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(() => {
    const token = localStorage.getItem('adminToken');
    const adminInfo = localStorage.getItem('adminInfo');
    let adminData = null;
    if (token && adminInfo) {
      try {
        adminData = { token, ...JSON.parse(adminInfo) };
      } catch (e) {
        console.warn('Failed to parse adminInfo:', e);
        adminData = { token };
      }
    }
    return adminData;
  });

 const login = (adminData) => {
  // console.log("Saving admin data:", adminData);
  localStorage.setItem('adminToken', adminData.token);

  // Handle both flat and nested admin structures
  const adminObj = adminData.admin || adminData;
  localStorage.setItem('adminInfo', JSON.stringify({
    _id: adminObj.id || adminObj._id,
    email: adminObj.email,
    name: adminObj.name,
    role: adminObj.role
  }));

  // Store the complete admin data for AuthContext
  setAdmin({
    token: adminData.token,
    _id: adminObj.id || adminObj._id,
    email: adminObj.email,
    name: adminObj.name,
    role: adminObj.role,
    isActive: adminObj.isActive
  });
};



  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
