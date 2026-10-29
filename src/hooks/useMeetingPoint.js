import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { acceptMeetingPoint, getMeetingPoint, proposeMeetingPoint } from '../services/claimsApi';
import { getErrorMessage } from '../services/errors';

// Punto de encuentro de un reclamo aceptado: ver, proponer, aceptar o sugerir otro lugar.
// El servidor es la fuente de verdad: dice quién puede proponer o aceptar (canPropose / canAccept)
// y, si algo cambió mientras la pantalla estaba abierta, el error se muestra y se vuelve a pedir el estado.
export default function useMeetingPoint(claimId) {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [showForm, setShowForm] = useState(false); // formulario para sugerir otro lugar
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const sendingRef = useRef(false); // evita la doble pulsación

  const load = useCallback(async () => {
    setError('');
    try {
      setMeeting(await getMeetingPoint(claimId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Ejecuta una acción contra la API. Sin conexión no hay confirmación: queda el mensaje de error.
  const send = async (action) => {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setActionError('');
    try {
      setMeeting(await action()); // respuesta real del servidor con el estado nuevo
      return true;
    } catch (e) {
      setActionError(getErrorMessage(e));
      await load();
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Esta validación solo ahorra un viaje: el servidor vuelve a validar todo.
  const onPropose = async () => {
    if (!address.trim()) return setFieldError('Escribí la dirección o el lugar de encuentro.');
    setFieldError('');
    const ok = await send(() => proposeMeetingPoint(claimId, { address, notes }));
    if (ok) {
      setAddress('');
      setNotes('');
      setShowForm(false);
    }
  };

  const onAccept = () => send(() => acceptMeetingPoint(meeting.meetingPoint.id));

  return {
    meeting, loading, error, load,
    address, setAddress, notes, setNotes, fieldError,
    showForm, openForm: () => setShowForm(true), closeForm: () => setShowForm(false),
    sending, actionError, onPropose, onAccept,
  };
}
