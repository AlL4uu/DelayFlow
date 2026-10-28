import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { TaskCreate } from './pages/TaskCreate'
import { TaskDetail } from './pages/TaskDetail'
import { TaskEdit } from './pages/TaskEdit'
import { TaskList } from './pages/TaskList'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TaskList />} />
          <Route path="tasks/new" element={<TaskCreate />} />
          <Route path="tasks/:id/edit" element={<TaskEdit />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
