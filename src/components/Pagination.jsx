import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
      end = Math.min(totalPages, maxVisible);
    }

    if (currentPage >= totalPages - 2) {
      start = Math.max(1, totalPages - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-2 gap-6 text-gray-500">
      <span className="text-sm">Mostrando página {currentPage} de {totalPages}</span>
      <div className="flex items-center space-x-2 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
        <button
          className={`text-sm ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-violet-500 hover:underline'}`}
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          &lt; Anterior
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-8 h-8 rounded-full text-sm text-gray-500 hover:bg-gray-200">
              1
            </button>
            {pages[0] > 2 && <span className="text-gray-400">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded-full text-sm ${
              page === currentPage
                ? 'bg-violet-500 text-white font-semibold'
                : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            {page}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="text-gray-400">...</span>}
            <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 rounded-full text-sm text-gray-500 hover:bg-gray-200">
              {totalPages}
            </button>
          </>
        )}

        <button
          className={`text-sm ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-violet-500 hover:underline'}`}
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Siguiente &gt;
        </button>
      </div>
    </div>
  );
};

export default Pagination;