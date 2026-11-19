import { Navigate, useParams } from 'react-router-dom';

/** @deprecated Rota legada — redireciona para o cronograma com o mesmo token. */
export default function SessaoEstudos() {
  const { token } = useParams();
  return <Navigate to={token ? `/estudos/cronograma/${token}` : '/estudos/cronograma'} replace />;
}
