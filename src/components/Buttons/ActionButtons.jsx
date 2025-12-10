import React, { useState } from "react";
import { FiEye, FiEdit, FiTrash, FiArrowLeft, FiPlus} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { CopyCheck, DollarSign, RotateCcw, ClipboardPen, Lock, Unlock } from "lucide-react";
import { toast } from "../../lib/toast"

export function ViewDetailButton({ onClick, tooltipText }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-blue-500" title={tooltipText}>
      <FiEye className="w-5 h-5" />
    </button>
  );
}

export function ValidarButton({ onClick, tooltipText}) {
  return(
    <button onClick={onClick} className="text-gray-400 hover:text-blue-500" title={tooltipText}>
      <ClipboardPen className="w-5 h-5" />
    </button>
  )
}

export function UndoButton({ onClick, tooltipText }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-blue-500" title={tooltipText}>
      <RotateCcw className="w-5 h-5" />
    </button>
  );
}

export function AddButton({ onClick, tooltipText }) {
  return (
    <button onClick={onClick} title={tooltipText} className="text-green-600 hover:text-green-800">
      <FiPlus className="w-5 h-5" />
    </button>
  );
}

export function PagarButton({ onConfirm, tooltipText}) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  return (
    <>
      <button onClick={handleClick} className="text-gray-400 hover:text-blue-500" title={tooltipText}>
      <DollarSign className="w-5 h-5" />
    </button>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4">¿Estás segura de que quieres pagar esta orden?</h2>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleClose}
                className="bg-gray-300 hover:bg-gray-400 text-black font-medium py-2 px-4 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="bg-pink-600 hover:bg-pink-700 text-white font-medium py-2 px-4 rounded"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditButton({ onClick, tooltipText }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-blue-500" title={tooltipText}>
      <FiEdit className="w-5 h-5" />
    </button>
  );
}

export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, entityName = "elemento" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center break-words">
        <div className="flex flex-col items-center">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">¿Estás Seguro?</h2>
          
          <p className="text-gray-600 mb-6 text-sm leading-relaxed break-words">
            <span className="font-bold text-gray-800 uppercase">{entityName}</span> <br /> será{" "}
            <span className="text-red-600 font-semibold">eliminado</span> permanentemente del sistema, <br />
            junto con <span className="underline font-medium">sus datos relacionados</span>.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={onConfirm}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow"
            >
              Sí, Eliminar!
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrashButton({ onConfirmDelete, tooltipText, entityName = "elemento" }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleConfirm = () => {
    onConfirmDelete();
    handleCloseModal();
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="text-red-600 hover:text-red-700"
        title={tooltipText}
      >
        <FiTrash className="w-5 h-5" />
      </button>
      <ConfirmDeleteModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        entityName={entityName}
      />
    </>
  );
}

export function ModifyButton({ onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover">
      Modificar
    </button>
  );
}

export function DeleteButton({ onConfirmDelete, tooltipText, entityName = "elemento" }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);
  const handleConfirm = async () => {
    try {
      await onConfirmDelete(); // Call the passed function to handle deletion
    } catch (error) {
      console.error(`Error eliminando ${entityName}:`, error);
    }
    handleCloseModal();
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        title={tooltipText}
      >
        Eliminar
      </button>
      <ConfirmDeleteModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        entityName={entityName}
      />
    </>
  );
}

export function BackButton({ to = null, label = "Volver" }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
    >
      <FiArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}

export function DisableButton({ onConfirmDisable, tooltipText, entityName = "elemento" }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleConfirm = async () => {
    try {
      await onConfirmDisable();
    } catch (error) {
      toast.error(`Error deshabilitando ${entityName}:`, error);
    }
    handleCloseModal();
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="text-yellow-600 hover:text-yellow-700"
        title={tooltipText || "Deshabilitar"}
      >
        <Lock className="w-5 h-5" />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <div className="flex flex-col items-center">
              <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Deshabilitar Insumo</h2>

              <p className="text-gray-600 mb-6 text-sm leading-relaxed break-words whitespace-normal overflow-hidden text-ellipsis">
                ¿Seguro que deseas deshabilitar{" "}
                <span className="font-bold text-gray-800 uppercase break-all">{entityName}</span>?<br />
                Este dejará de estar disponible en la lista de insumos activos.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors shadow"
                >
                  Sí, Deshabilitar
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2 rounded-xl bg-gray-300 hover:bg-gray-400 text-black font-medium transition-colors shadow"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ToggleActiveButton({ 
  isActive, 
  onToggleActive, 
  entityName = "elemento",
  tooltipText 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);

  const handleConfirm = async () => {
    try {
      await onToggleActive();
      toast.success(
        isActive 
          ? `${entityName} deshabilitado correctamente`
          : `${entityName} habilitado correctamente`
      );
    } catch (error) {
      toast.error("Error al cambiar estado", error);
    }

    handleClose();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={
          isActive
            ? "text-yellow-600 hover:text-yellow-700"
            : "text-green-600 hover:text-green-700"
        }
        title={tooltipText || (isActive ? "Deshabilitar" : "Habilitar")}
      >
        {isActive ? (
          <TrashButton className="w-5 h-5" />
        ) : (
          <Unlock className="w-5 h-5" />
        )}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <div className="flex flex-col items-center">
              <div className={`${isActive ? "text-yellow-500" : "text-green-600"} text-5xl mb-4`}>
                ⚠️
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {isActive ? "Deshabilitar" : "Habilitar"} {entityName}
              </h2>

              <p className="text-gray-600 mb-6 text-sm leading-relaxed break-words whitespace-normal overflow-hidden text-ellipsis">
                ¿Seguro que deseas{" "}
                <span className="font-bold uppercase">{isActive ? "deshabilitar" : "habilitar"}</span>{" "}
                este {entityName}?
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={handleConfirm}
                  className={
                    isActive
                      ? "px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition shadow"
                      : "px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition shadow"
                  }
                >
                  Sí, {isActive ? "Deshabilitar" : "Habilitar"}
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl bg-gray-300 hover:bg-gray-400 text-black font-medium transition shadow"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

