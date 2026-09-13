package com.gymapp.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public class PageDtos {

    // Every paginated endpoint returns this same shape - one consistent contract for the
    // frontend regardless of which resource is being paged.
    public record PageResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean last
    ) {
        public static <T> PageResponse<T> from(Page<T> page) {
            return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                    page.getTotalElements(), page.getTotalPages(), page.isLast());
        }
    }
}